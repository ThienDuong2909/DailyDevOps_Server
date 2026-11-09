const crypto = require('node:crypto');
const config = require('../../config');
const { getPrismaClient } = require('../../database/prisma');
const { generateFeaturedImage } = require('./posts.image-generator');

const prisma = getPrismaClient();

const JOB_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
};

class PostsThumbnailGenerationService {
    timer = null;

    isRunning = false;

    async ensureTable() {
        // Table is managed via Prisma schema (PostFeaturedImageJob / post_featured_image_jobs)
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
        const now = new Date();
        await prisma.postFeaturedImageJob.updateMany({
            where: {
                postId,
                status: JOB_STATUS.PENDING,
            },
            data: {
                status: JOB_STATUS.CANCELLED,
                errorMessage: 'Superseded by a newer thumbnail request',
                completedAt: now,
                updatedAt: now,
            },
        });

        const id = crypto.randomUUID();
        const job = await prisma.postFeaturedImageJob.create({
            data: {
                id,
                postId,
                requestedById: requestedById || null,
                status: JOB_STATUS.PENDING,
                payloadJson: JSON.stringify(input || {}),
            },
        });

        return this.serializeJob(job);
    }

    async getLatestJob(postId) {
        const job = await prisma.postFeaturedImageJob.findFirst({
            where: { postId },
            orderBy: { createdAt: 'desc' },
        });

        return this.serializeJob(job);
    }

    async getJobById(id) {
        const job = await prisma.postFeaturedImageJob.findUnique({
            where: { id },
        });

        return this.serializeJob(job);
    }

    async runOnce() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        try {
            await this.processNextJob();
        } catch (error) {
            console.error('[scheduler] Failed to process featured image jobs:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async processNextJob() {
        const nextJob = await prisma.postFeaturedImageJob.findFirst({
            where: { status: JOB_STATUS.PENDING },
            orderBy: { createdAt: 'asc' },
        });

        if (!nextJob) {
            return null;
        }

        const processorToken = crypto.randomUUID();
        const now = new Date();

        const claimed = await prisma.postFeaturedImageJob.updateMany({
            where: {
                id: nextJob.id,
                status: JOB_STATUS.PENDING,
            },
            data: {
                status: JOB_STATUS.PROCESSING,
                processorToken,
                startedAt: nextJob.startedAt || now,
                attemptCount: (nextJob.attemptCount || 0) + 1,
                updatedAt: now,
            },
        });

        if (!claimed.count) {
            return null;
        }

        const job = await prisma.postFeaturedImageJob.findUnique({
            where: { id: nextJob.id },
        });

        if (!job) {
            return null;
        }

        try {
            const payload = this.parsePayload(job.payloadJson);
            const result = await generateFeaturedImage(payload);

            await prisma.post.update({
                where: { id: job.postId },
                data: {
                    featuredImage: result.imageUrl,
                },
            });

            const updated = await prisma.postFeaturedImageJob.update({
                where: { id: job.id },
                data: {
                    status: JOB_STATUS.SUCCEEDED,
                    resultImageUrl: result.imageUrl,
                    resultStorageKey: result.storageKey || null,
                    resultMimeType: result.mimeType || null,
                    promptText: result.prompt || null,
                    errorMessage: null,
                    completedAt: new Date(),
                    processorToken: null,
                },
            });

            return this.serializeJob(updated);
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : 'Thumbnail generation failed';

            const updated = await prisma.postFeaturedImageJob.update({
                where: { id: job.id },
                data: {
                    status: JOB_STATUS.FAILED,
                    errorMessage: message,
                    completedAt: new Date(),
                    processorToken: null,
                },
            });

            return this.serializeJob(updated);
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
            postId: job.postId || job.post_id,
            requestedById: job.requestedById ?? job.requested_by_id ?? null,
            status: job.status,
            imageUrl: job.resultImageUrl || job.result_image_url || null,
            storageKey: job.resultStorageKey || job.result_storage_key || null,
            mimeType: job.resultMimeType || job.result_mime_type || null,
            prompt: job.promptText || job.prompt_text || null,
            errorMessage: job.errorMessage || job.error_message || null,
            attemptCount: Number(job.attemptCount ?? job.attempt_count ?? 0),
            startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
            completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
            createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
            updatedAt: job.updatedAt ? new Date(job.updatedAt).toISOString() : null,
        };
    }
}

module.exports = new PostsThumbnailGenerationService();
module.exports.JOB_STATUS = JOB_STATUS;
