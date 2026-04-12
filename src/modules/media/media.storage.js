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

async function uploadObject({ key, body, contentType, cacheControl }) {
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
    const client = getS3Client();

    return client.send(
        new GetObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        })
    );
}

async function listObjects(prefix) {
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
