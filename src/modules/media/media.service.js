const path = require('path');
const crypto = require('crypto');
const { NotFoundError, BadRequestError } = require('../../middlewares/error.middleware');
const { uploadObject, getObject, listObjects, deleteObject } = require('./media.storage');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

class MediaService {
    ensureFileIsValid(file) {
        if (!file) {
            throw new Error('Image file is required');
        }

        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            throw new Error('Unsupported image type. Use jpg, png, webp, or gif');
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error('Image must be 5 MB or smaller');
        }
    }

    resolveUploadDirectory(purpose) {
        switch (purpose) {
            case 'post-media':
            case 'featured-image':
            case 'media':
                return 'media/posts';
            case 'avatar':
                return 'avatars/users';
            case 'seo':
                return 'media/seo';
            case 'newsletter':
                return 'media/newsletter';
            default:
                return 'media/posts';
        }
    }

    async uploadImage(file, options = {}) {
        this.ensureFileIsValid(file);
        return this.uploadBuffer(
            {
                buffer: file.buffer,
                size: file.size,
                mimetype: file.mimetype,
                originalname: file.originalname,
            },
            options
        );
    }

    async uploadBuffer(file, options = {}) {
        this.ensureFileIsValid(file);

        const baseName = path.parse(file.originalname || 'upload').name;
        const extension = path.extname(file.originalname || '').toLowerCase();
        const safeBaseName = String(baseName)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50) || 'image';

        const normalizedExtension = extension || this.resolveExtensionFromMimeType(file.mimetype);
        const directory = this.resolveUploadDirectory(options.purpose);
        const key = `${directory}/${new Date().toISOString().slice(0, 10)}/${safeBaseName}-${crypto.randomUUID()}${normalizedExtension}`;

        await uploadObject({
            key,
            body: file.buffer,
            contentType: file.mimetype,
            cacheControl: 'public, max-age=31536000, immutable',
        });

        return {
            key,
            url: `/api/v1/media/object?key=${encodeURIComponent(key)}`,
            contentType: file.mimetype,
            size: file.size,
        };
    }

    resolveExtensionFromMimeType(mimeType) {
        switch (mimeType) {
            case 'image/jpeg':
                return '.jpg';
            case 'image/png':
                return '.png';
            case 'image/webp':
                return '.webp';
            case 'image/gif':
                return '.gif';
            default:
                return '';
        }
    }

    async getImageObject(key) {
        try {
            return await getObject(key);
        } catch (error) {
            if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
                throw new NotFoundError('Media object not found');
            }

            throw error;
        }
    }

    async listMediaLibrary() {
        const result = await listObjects('media/');
        const items = (result.Contents || [])
            .filter((item) => item.Key)
            .sort((a, b) => new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime())
            .map((item) => ({
                key: item.Key,
                size: item.Size || 0,
                lastModified: item.LastModified ? new Date(item.LastModified).toISOString() : null,
                url: `/api/v1/media/object?key=${encodeURIComponent(item.Key)}`,
            }));

        return items;
    }

    async deleteMediaObject(key) {
        if (
            !key ||
            (!key.startsWith('media/') && !key.startsWith('avatars/'))
        ) {
            throw new BadRequestError('Invalid media key');
        }

        await deleteObject(key);

        return {
            success: true,
            key,
        };
    }
}

module.exports = new MediaService();
