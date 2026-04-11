const crypto = require('crypto');
const config = require('../../config');
const { getPrismaClient } = require('../../database/prisma');
const { generateFeaturedImage } = require('./posts.image-generator');

const prisma = getPrismaClient();

const JOB_TABLE_NAME = 'post_featured_image_jobs';
const JOB_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
};

class PostsThumbnailGenerationService {
    constructor() {
        this.timer = null;
        this.isRunning = false;
        this.tableReadyPromise = null;
    }

    async ensureTable() {
        if (!this.tableReadyPromise) {
            this.tableReadyPromise = prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS ${JOB_TABLE_NAME} (
                    id VARCHAR(191) NOT NULL PRIMARY KEY,
                    post_id VARCHAR(191) NOT NULL,
                    requested_by_id VARCHAR(191) NULL,
                    status VARCHAR(32) NOT NULL,
                    payload_json LONGTEXT NOT NULL,
                    result_image_url TEXT NULL,
                    result_storage_key VARCHAR(512) NULL,
                    result_mime_type VARCHAR(128) NULL,
                    prompt_text LONGTEXT NULL,
                    error_message TEXT NULL,
                    attempt_count INT NOT NULL DEFAULT 0,
                    processor_token VARCHAR(191) NULL,
                    started_at DATETIME(3) NULL,
                    completed_at DATETIME(3) NULL,
                    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                    INDEX idx_pfij_post_created (post_id, created_at),
                    INDEX idx_pfij_status_created (status, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }

        await this.tableReadyPromise;
    }

    start() {
        if (this.timer) {
            return;
        }

        const intervalMs = config.jobs.thumbnailGenerationIntervalMs;

        setTimeout(() => {
            void this.runOnce();
        }, 2500);

        this.timer = setInterval(() => {
            void this.runOnce();
        }, intervalMs);

        console.log(
            `[scheduler] Thumbnail generation worker started (${intervalMs}ms interval)`
        );
    }

    async stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async enqueueJob({ postId, requestedById, input }) {
        await this.ensureTable();

        await prisma.$executeRawUnsafe(
            `
                UPDATE ${JOB_TABLE_NAME}
                SET status = ?, error_message = ?, completed_at = NOW(3), updated_at = NOW(3)
                WHERE post_id = ? AND status = ?
            `,
            JOB_STATUS.CANCELLED,
            'Superseded by a newer thumbnail request',
            postId,
            JOB_STATUS.PENDING
        );

        const id = crypto.randomUUID();

        await prisma.$executeRawUnsafe(
            `
                INSERT INTO ${JOB_TABLE_NAME} (
                    id,
                    post_id,
                    requested_by_id,
                    status,
                    payload_json
                ) VALUES (?, ?, ?, ?, ?)
            `,
            id,
            postId,
            requestedById || null,
            JOB_STATUS.PENDING,
            JSON.stringify(input || {})
        );

        return this.getJobById(id);
    }

    async getLatestJob(postId) {
        await this.ensureTable();

        const rows = await prisma.$queryRawUnsafe(
            `
                SELECT *
                FROM ${JOB_TABLE_NAME}
                WHERE post_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            `,
            postId
        );

        return this.serializeJob(rows[0] || null);
    }

    async getJobById(id) {
        await this.ensureTable();

        const rows = await prisma.$queryRawUnsafe(
            `
                SELECT *
                FROM ${JOB_TABLE_NAME}
                WHERE id = ?
                LIMIT 1
            `,
            id
        );

        return this.serializeJob(rows[0] || null);
    }

    async runOnce() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        try {
            await this.ensureTable();
            await this.processNextJob();
        } catch (error) {
            console.error('[scheduler] Failed to process featured image jobs:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async processNextJob() {
        const processorToken = crypto.randomUUID();
        const claimedCount = await prisma.$executeRawUnsafe(
            `
                UPDATE ${JOB_TABLE_NAME}
                SET status = ?,
                    processor_token = ?,
                    started_at = COALESCE(started_at, NOW(3)),
                    attempt_count = attempt_count + 1,
                    updated_at = NOW(3)
                WHERE id = (
                    SELECT id FROM (
                        SELECT id
                        FROM ${JOB_TABLE_NAME}
                        WHERE status = ?
                        ORDER BY created_at ASC
                        LIMIT 1
                    ) AS next_job
                )
            `,
            JOB_STATUS.PROCESSING,
            processorToken,
            JOB_STATUS.PENDING
        );

        if (!claimedCount) {
            return null;
        }

        const rows = await prisma.$queryRawUnsafe(
            `
                SELECT *
                FROM ${JOB_TABLE_NAME}
                WHERE processor_token = ? AND status = ?
                ORDER BY started_at DESC
                LIMIT 1
            `,
            processorToken,
            JOB_STATUS.PROCESSING
        );

        const job = rows[0];
        if (!job) {
            return null;
        }

        try {
            const payload = this.parsePayload(job.payload_json);
            const result = await generateFeaturedImage(payload);

            await prisma.post.update({
                where: { id: job.post_id },
                data: {
                    featuredImage: result.imageUrl,
                },
            });

            await prisma.$executeRawUnsafe(
                `
                    UPDATE ${JOB_TABLE_NAME}
                    SET status = ?,
                        result_image_url = ?,
                        result_storage_key = ?,
                        result_mime_type = ?,
                        prompt_text = ?,
                        error_message = NULL,
                        completed_at = NOW(3),
                        processor_token = NULL,
                        updated_at = NOW(3)
                    WHERE id = ?
                `,
                JOB_STATUS.SUCCEEDED,
                result.imageUrl,
                result.storageKey || null,
                result.mimeType || null,
                result.prompt || null,
                job.id
            );

            return this.getJobById(job.id);
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : 'Thumbnail generation failed';

            await prisma.$executeRawUnsafe(
                `
                    UPDATE ${JOB_TABLE_NAME}
                    SET status = ?,
                        error_message = ?,
                        completed_at = NOW(3),
                        processor_token = NULL,
                        updated_at = NOW(3)
                    WHERE id = ?
                `,
                JOB_STATUS.FAILED,
                message,
                job.id
            );

            return this.getJobById(job.id);
        }
    }

    parsePayload(value) {
        try {
            const parsed = JSON.parse(String(value || '{}'));
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    serializeJob(job) {
        if (!job) {
            return null;
        }

        return {
            id: job.id,
            postId: job.post_id,
            requestedById: job.requested_by_id,
            status: job.status,
            imageUrl: job.result_image_url || null,
            storageKey: job.result_storage_key || null,
            mimeType: job.result_mime_type || null,
            prompt: job.prompt_text || null,
            errorMessage: job.error_message || null,
            attemptCount: Number(job.attempt_count || 0),
            startedAt: job.started_at ? new Date(job.started_at).toISOString() : null,
            completedAt: job.completed_at ? new Date(job.completed_at).toISOString() : null,
            createdAt: job.created_at ? new Date(job.created_at).toISOString() : null,
            updatedAt: job.updated_at ? new Date(job.updated_at).toISOString() : null,
        };
    }
}

module.exports = new PostsThumbnailGenerationService();
module.exports.JOB_STATUS = JOB_STATUS;
