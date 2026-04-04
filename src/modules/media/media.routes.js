const express = require('express');
const multer = require('multer');
const asyncHandler = require('express-async-handler');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { sendCreated, sendSuccess } = require('../../common/http/responses');
const mediaService = require('./media.service');
const {
    mediaObjectQuerySchema,
    mediaDeleteSchema,
    mediaUploadPurposeSchema,
} = require('./media.validation');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

router.get(
    '/',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    asyncHandler(async (_req, res) => {
        const items = await mediaService.listMediaLibrary();
        return res.status(200).json({
            success: true,
            data: items,
        });
    })
);

router.post(
    '/upload',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    upload.single('file'),
    asyncHandler(async (req, res) => {
        const { error, value } = mediaUploadPurposeSchema.validate(req.body?.purpose);

        if (error) {
            throw error;
        }

        const result = await mediaService.uploadImage(req.file, {
            purpose: value,
        });
        return sendCreated(res, {
            data: result,
        });
    })
);

router.get(
    '/object',
    validate(mediaObjectQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
        const object = await mediaService.getImageObject(req.query.key);
        const body = object.Body;

        res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        if (object.CacheControl) {
            res.setHeader('Cache-Control', object.CacheControl);
        }
        if (object.ContentLength) {
            res.setHeader('Content-Length', String(object.ContentLength));
        }

        if (body && typeof body.pipe === 'function') {
            body.pipe(res);
            return;
        }

        if (body && typeof body.transformToByteArray === 'function') {
            const bytes = await body.transformToByteArray();
            res.end(Buffer.from(bytes));
            return;
        }

        res.end(body);
    })
);

router.delete(
    '/',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR'),
    validate(mediaDeleteSchema),
    asyncHandler(async (req, res) => {
        const result = await mediaService.deleteMediaObject(req.body.key);
        return sendSuccess(res, {
            data: result,
        });
    })
);

module.exports = router;
