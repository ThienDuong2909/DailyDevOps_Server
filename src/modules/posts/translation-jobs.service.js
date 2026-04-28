const { BadRequestError, ForbiddenError, NotFoundError } = require('../../middlewares/error.middleware');
const translationJobsRepository = require('./translation-jobs.repository');
const postsRepository = require('./posts.repository');
const { translatePost } = require('./posts.translator');
const {
    buildPublishedAt,
    generateSlug,
    normalizeTranslationPayload,
} = require('./posts.helpers');

const ACTIVE_STATUSES = ['PENDING', 'RUNNING'];
const EDITORIAL_ROLES = new Set(['ADMIN', 'EDITOR', 'MODERATOR', 'AUTHOR']);
const SUPPORTED_LOCALES = new Set(['en']);

const isEditorialRole = (role) => EDITORIAL_ROLES.has(role);

const canEditPost = (post, userId, userRole) => {
    if (!post) {
        return false;
    }
    if (userRole === 'ADMIN' || userRole === 'MODERATOR' || userRole === 'EDITOR') {
        return true;
    }
    return post.authorId === userId;
};

const toJobDTO = (job) => {
    if (!job) {
        return null;
    }
    return {
        id: job.id,
        postId: job.postId,
        locale: job.locale,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep || null,
        error: job.error || null,
        result:
            job.status === 'COMPLETED'
                ? {
                      title: job.resultTitle || '',
                      slug: job.resultSlug || '',
                      excerpt: job.resultExcerpt || '',
                      subtitle: job.resultExcerpt || '',
                      content: job.resultContent || '',
                      contentHtml: job.resultContent || '',
                  }
                : null,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
    };
};

class TranslationJobsService {
    /**
     * On server startup: any job left in PENDING/RUNNING from a previous
     * process is orphaned — mark it FAILED so the UI doesn't show a false
     * "in progress" state forever. Also re-runs any that might have been
     * queued (we don't persist across restarts here — simplest behavior).
     */
    async recoverOrphanedJobs() {
        try {
            const { count } = await translationJobsRepository.deleteMany({
                where: { status: { in: ACTIVE_STATUSES } },
            });
            if (count > 0) {
                console.log(
                    `[TranslationJobs] Cleaned up ${count} orphaned in-flight job(s) from previous process`
                );
            }
        } catch (error) {
            console.error('[TranslationJobs] Failed to clean up orphaned jobs:', error.message);
        }
    }

    /**
     * Create a translation job for a post. If an active job already exists for
     * the same (post, locale) pair, return it instead of creating a duplicate.
     * If the post already has a published translation for the locale, reject.
     */
    async enqueueJob({ postId, userId, userRole, locale = 'en', force = false }) {
        if (!isEditorialRole(userRole)) {
            throw new ForbiddenError('Only editorial roles can translate posts');
        }

        if (!SUPPORTED_LOCALES.has(locale)) {
            throw new BadRequestError(`Locale "${locale}" is not supported for auto-translation`);
        }

        const post = await postsRepository.findUnique({
            where: { id: postId },
            include: {
                translations: {
                    where: { locale },
                    select: { id: true, status: true },
                },
            },
        });

        if (!post) {
            throw new NotFoundError('Post not found');
        }

        if (!canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only translate your own posts');
        }

        if (!force && post.translations && post.translations.length > 0) {
            throw new BadRequestError(
                `Post already has a ${locale.toUpperCase()} translation. Delete it first or pass force=true to overwrite.`
            );
        }

        // De-duplicate: return existing active job if one is already in flight.
        const existingActive = await translationJobsRepository.findFirst({
            where: { postId, locale, status: { in: ACTIVE_STATUSES } },
            orderBy: { createdAt: 'desc' },
        });
        if (existingActive) {
            return toJobDTO(existingActive);
        }

        const job = await translationJobsRepository.create({
            postId,
            locale,
            status: 'PENDING',
            progress: 0,
            currentStep: 'queued',
            startedById: userId || null,
        });

        // Fire-and-forget: run the job in the background. We do not await —
        // the caller's HTTP response should return immediately with the job
        // row so the client can start polling. The top-level wrapper swallows
        // every rejection to avoid tripping the server's unhandledRejection
        // handler (which calls process.exit).
        setImmediate(() => {
            this.safelyProcessJob(job.id);
        });

        return toJobDTO(job);
    }

    /**
     * Non-throwing wrapper around processJob used by the background worker
     * dispatcher. Any error here must NEVER escape as an unhandled rejection.
     */
    safelyProcessJob(jobId) {
        Promise.resolve()
            .then(() => this.processJob(jobId))
            .catch((error) => {
                const message = error && error.message ? error.message : String(error);
                console.error(
                    `[TranslationJobs] Uncaught error while processing job ${jobId}:`,
                    message
                );
                // Last-resort status write; swallow any failure from this too.
                return translationJobsRepository
                    .update(jobId, {
                        status: 'FAILED',
                        currentStep: 'failed',
                        error: `Unhandled worker error: ${message}`.slice(0, 2000),
                        completedAt: new Date(),
                    })
                    .catch((writeError) => {
                        console.error(
                            `[TranslationJobs] Also failed to persist FAILED state for ${jobId}:`,
                            writeError && writeError.message
                        );
                    });
            });
    }

    /**
     * Load the post that owns the job (if any) and assert the caller may
     * access it. Used by the GET endpoints to prevent one author from
     * peeking at another author's translation jobs.
     */
    async assertCanAccessPost(postId, userId, userRole) {
        if (!isEditorialRole(userRole)) {
            throw new ForbiddenError('Only editorial roles can view translation jobs');
        }
        const post = await postsRepository.findUnique({ where: { id: postId } });
        if (!post) {
            throw new NotFoundError('Post not found');
        }
        if (!canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only view translation jobs for posts you can edit');
        }
        return post;
    }

    async getLatestJobForPost({ postId, userId, userRole, locale = 'en' }) {
        await this.assertCanAccessPost(postId, userId, userRole);
        const job = await translationJobsRepository.findLatestForPost(postId, locale);
        return toJobDTO(job);
    }

    async getJobById({ jobId, postId, userId, userRole }) {
        const job = await translationJobsRepository.findById(jobId);
        if (!job) {
            throw new NotFoundError('Translation job not found');
        }
        if (postId && job.postId !== postId) {
            throw new NotFoundError('Translation job not found');
        }
        await this.assertCanAccessPost(job.postId, userId, userRole);
        return toJobDTO(job);
    }

    /**
     * Worker entry point. Loads the post, runs the translator, persists the
     * PostTranslation, and updates the job row along the way.
     */
    async processJob(jobId) {
        const job = await translationJobsRepository.findById(jobId);
        if (!job) {
            console.warn(`[TranslationJobs] Job ${jobId} disappeared before processing`);
            return;
        }
        if (job.status !== 'PENDING') {
            console.warn(
                `[TranslationJobs] Skipping job ${jobId} because status is ${job.status}`
            );
            return;
        }

        await translationJobsRepository.update(jobId, {
            status: 'RUNNING',
            startedAt: new Date(),
            currentStep: 'loading post',
            progress: 5,
        });

        let post;
        try {
            post = await postsRepository.findUnique({ where: { id: job.postId } });
            if (!post) {
                throw new Error('Post was deleted before translation could start');
            }

            const sourceContent = {
                title: post.title,
                subtitle: post.subtitle || post.excerpt || '',
                excerpt: post.subtitle || post.excerpt || '',
                content: post.content || '',
                contentHtml: post.contentHtml || post.content || '',
            };

            const contentSize = (sourceContent.contentHtml || '').length;
            const estimatedChunks = Math.max(1, Math.ceil(contentSize / 3500));

            const translated = await translatePost(sourceContent, {
                onProgress: async (info) => {
                    try {
                        let progress = 10;
                        let step = 'translating';
                        if (info.phase === 'title') {
                            progress = 10;
                            step = 'title done';
                        } else if (info.phase === 'excerpt') {
                            progress = 20;
                            step = 'excerpt done';
                        } else if (info.phase === 'content') {
                            const current = info.current || 1;
                            const total = info.total || estimatedChunks;
                            progress = 20 + Math.floor((75 * current) / total);
                            step = `content chunk ${current}/${total}`;
                        }
                        await translationJobsRepository.update(jobId, {
                            progress: Math.min(95, progress),
                            currentStep: step,
                        });
                    } catch (progressError) {
                        // Don't let progress update failures break the job
                        console.warn(
                            `[TranslationJobs] Failed to update progress for ${jobId}:`,
                            progressError.message
                        );
                    }
                },
            });

            await translationJobsRepository.update(jobId, {
                progress: 95,
                currentStep: 'saving translation',
            });

            await this.persistTranslation({ post, translated, locale: job.locale });

            await translationJobsRepository.update(jobId, {
                status: 'COMPLETED',
                progress: 100,
                currentStep: 'completed',
                resultTitle: translated.title,
                resultSlug: translated.slug,
                resultExcerpt: translated.excerpt,
                resultContent: translated.contentHtml,
                completedAt: new Date(),
                error: null,
            });

            console.log(`[TranslationJobs] Completed job ${jobId} for post ${job.postId}`);
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : 'Translation failed';

            await translationJobsRepository.update(jobId, {
                status: 'FAILED',
                currentStep: 'failed',
                error: message.slice(0, 2000),
                completedAt: new Date(),
            });

            console.error(`[TranslationJobs] Job ${jobId} failed:`, message);
        }
    }

    /**
     * Upsert the PostTranslation row for the post using the translator output.
     * Runs under the worker, so we use the repository directly rather than
     * PostsService.upsertTranslation (which enforces per-user edit permissions
     * that don't apply to a background worker).
     */
    async persistTranslation({ post, translated, locale }) {
        const normalized = normalizeTranslationPayload({
            locale,
            title: translated.title,
            slug: translated.slug,
            subtitle: translated.subtitle,
            excerpt: translated.excerpt,
            content: translated.content,
            contentHtml: translated.contentHtml,
            status: post.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        });

        const baseSlug = (normalized.slug && normalized.slug.trim()) || generateSlug(normalized.title);
        const uniqueSlug = await this.ensureUniqueSlug(baseSlug, locale, post.id);
        const targetStatus = normalized.status || 'DRAFT';

        // Preserve the original publishedAt when updating an already-published
        // translation so force-retranslating doesn't reset the public
        // publication date.
        const existingTranslation = await postsRepository.findFirstTranslation({
            where: { postId: post.id, locale },
        });

        return postsRepository.upsertTranslation({
            where: {
                postId_locale: { postId: post.id, locale },
            },
            update: {
                ...normalized,
                slug: uniqueSlug,
                locale,
                status: targetStatus,
                publishedAt: buildPublishedAt(
                    targetStatus,
                    existingTranslation?.publishedAt || null
                ),
            },
            create: {
                postId: post.id,
                ...normalized,
                slug: uniqueSlug,
                locale,
                status: targetStatus,
                publishedAt: buildPublishedAt(targetStatus, null),
            },
        });
    }

    /**
     * Guarantee a unique slug per (locale, slug). Mirror the logic used by
     * PostsService.ensureUniqueTranslationSlug without introducing a circular
     * service dependency.
     */
    async ensureUniqueSlug(baseSlug, locale, postId, maxAttempts = 25) {
        let candidate = baseSlug || 'untitled';
        let attempt = 1;

        while (attempt <= maxAttempts) {
            const existing = await postsRepository.findUniqueTranslation({
                where: { locale_slug: { locale, slug: candidate } },
            });

            if (!existing || existing.postId === postId) {
                return candidate;
            }

            candidate = `${baseSlug}-${attempt}`;
            attempt += 1;
        }

        return `${baseSlug}-${Date.now()}`;
    }
}

module.exports = new TranslationJobsService();
