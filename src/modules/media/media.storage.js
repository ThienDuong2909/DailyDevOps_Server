const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const config = require('../../config');

let s3Client;

function getS3Client() {
    if (!s3Client) {
        s3Client = new S3Client({
            region: config.storage.region,
            endpoint: config.storage.endpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: config.storage.accessKeyId,
                secretAccessKey: config.storage.secretAccessKey,
            },
        });
    }

    return s3Client;
}

function getR2Bucket() {
    return globalThis.__CF_R2_BINDING || null;
}

async function uploadObject({ key, body, contentType, cacheControl }) {
    const r2 = getR2Bucket();
    if (r2) {
        await r2.put(key, body, {
            httpMetadata: {
                contentType: contentType || 'application/octet-stream',
                cacheControl: cacheControl || 'public, max-age=31536000, immutable',
            },
        });
        return;
    }

    const client = getS3Client();

    await client.send(
        new PutObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: cacheControl,
        })
    );
}

async function getObject(key) {
    const r2 = getR2Bucket();
    if (r2) {
        const obj = await r2.get(key);
        if (!obj) {
            const err = new Error('NoSuchKey');
            err.name = 'NoSuchKey';
            throw err;
        }
        const arrayBuf = await obj.arrayBuffer();
        return {
            Body: Buffer.from(arrayBuf),
            ContentType: obj.httpMetadata?.contentType || 'application/octet-stream',
            CacheControl: obj.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable',
            ContentLength: obj.size,
        };
    }

    const client = getS3Client();

    return client.send(
        new GetObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        })
    );
}

async function listObjects(prefix) {
    const r2 = getR2Bucket();
    if (r2) {
        const contents = [];
        let cursor;
        do {
            const listed = await r2.list({
                prefix,
                limit: 500,
                cursor,
            });
            for (const obj of listed.objects || []) {
                contents.push({
                    Key: obj.key,
                    Size: obj.size,
                    LastModified: obj.uploaded,
                });
            }
            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);
        return { Contents: contents };
    }

    const client = getS3Client();
    const contents = [];
    let continuationToken;

    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: config.storage.bucket,
                Prefix: prefix,
                MaxKeys: 200,
                ContinuationToken: continuationToken,
            })
        );

        contents.push(...(response.Contents || []));
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return { Contents: contents };
}

async function deleteObject(key) {
    const r2 = getR2Bucket();
    if (r2) {
        await r2.delete(key);
        return;
    }

    const client = getS3Client();

    await client.send(
        new DeleteObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        })
    );
}

module.exports = {
    uploadObject,
    getObject,
    listObjects,
    deleteObject,
};
