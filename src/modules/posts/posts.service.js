const { NotFoundError, ForbiddenError } = require('../../middlewares/error.middleware');
const postsRepository = require('./posts.repository');
const {
    adminWriteInclude,
    detailPostInclude,
    listPostInclude,
    publicPostInclude,
    relatedPostsInclude,
    statsRecentPostsSelect,
} = require('./posts.queries');
const {
    buildListQuery,
    buildPaginatedResponse,
    buildPublishedAt,
    buildReadingTime,
    buildTagConnect,
    buildTagReplace,
    DEFAULT_LOCALE,
    generateSlug,
    isDefaultLocale,
    normalizeLocale,
    normalizeEditorPayload,
    normalizeTranslationPayload,
    serializePost,
    serializePosts,
    serializeVersions,
} = require('./posts.helpers');
const { postVersionListSelect } = require('./posts.queries');
const subscribersService = require('../subscribers/subscribers.service');
const { parseNotionExport } = require('./posts.importer');
const { generateFeaturedImage } = require('./posts.image-generator');
const translationJobsService = require('./translation-jobs.service');
const thumbnailGenerationService = require('./posts.thumbnail-generation.service');

class PostsService {
    /**
     * Find all posts with filtering and pagination
     */
    async findAll(query) {
        const { page, limit, skip, where, orderBy, locale } = buildListQuery(query);

        const [posts, total] = await Promise.all([
            postsRepository.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: listPostInclude,
            }),
            postsRepository.count({ where }),
        ]);

        return buildPaginatedResponse({ data: serializePosts(posts, locale), total, page, limit });
    }

    /**
     * Find published posts for public blog
     */
    async findPublished(query) {
        return this.findAll({
            ...query,
            status: 'PUBLISHED',
        });
    }

    async autocomplete(query) {
        const search = String(query.q || '').trim();
        const limit = Number(query.limit || 5);
        const locale = normalizeLocale(query.locale);

        if (!search) {
            return [];
        }

        const posts = await postsRepository.findMany({
            where: {
                status: 'PUBLISHED',
                OR: isDefaultLocale(locale)
                    ? [
                        { title: { contains: search } },
                        { excerpt: { contains: search } },
                        { slug: { contains: search } },
                    ]
                    : [
                        {
                            translations: {
                                some: {
                                    locale,
                                    status: 'PUBLISHED',
                                    title: { contains: search },
                                },
                            },
                        },
                        {
                            translations: {
                                some: {
                                    locale,
                                    status: 'PUBLISHED',
                                    excerpt: { contains: search },
                                },
                            },
                        },
                        {
                            translations: {
                                some: {
                                    locale,
                                    status: 'PUBLISHED',
                                    slug: { contains: search },
                                },
                            },
                        },
                    ],
            },
            take: limit,
            orderBy: [
                { publishedAt: 'desc' },
                { createdAt: 'desc' },
            ],
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                translations: {
                    where: { locale },
                    take: 1,
                },
            },
        });

        return serializePosts(posts, locale).map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt || '',
            featuredImage: post.featuredImage || null,
            publishedAt: post.publishedAt || null,
            category: post.category || null,
        }));
    }

    /**
     * Find post by ID
     */
    async findById(id) {
        const post = await postsRepository.findUnique({
            where: { id },
            include: detailPostInclude,
        });

        if (!post) {
            throw new NotFoundError('Post not found');
        }

        return serializePost(post);
    }

    async getTranslation(id, locale, userId, userRole) {
        const post = await postsRepository.findUnique({
            where: { id },
            include: detailPostInclude,
        });

        if (!post) {
            throw new NotFoundError('Post not found');
        }

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only edit your own posts');
        }

        const resolvedLocale = normalizeLocale(locale);

        if (isDefaultLocale(resolvedLocale)) {
            return serializePost(post);
        }

        return Array.isArray(post.translations)
            ? post.translations.find((item) => item.locale === resolvedLocale) || null
            : null;
    }

    /**
     * Find post by slug (for public view)
     */
    async findBySlug(slug, locale = DEFAULT_LOCALE) {
        const resolvedLocale = normalizeLocale(locale);
        let post = null;

        if (isDefaultLocale(resolvedLocale)) {
            post = await postsRepository.findUnique({
                where: { slug },
                include: publicPostInclude,
            });
        } else {
            const translation = await postsRepository.findFirstTranslation({
                where: {
                    locale: resolvedLocale,
                    slug,
                    status: 'PUBLISHED',
                    post: {
                        status: 'PUBLISHED',
                    },
                },
                include: {
                    post: {
                        include: publicPostInclude,
                    },
                },
            });

            post = translation?.post || null;
        }

        if (!post) {
            if (!isDefaultLocale(resolvedLocale)) {
                const sourcePost = await postsRepository.findFirst({
                    where: {
                        slug,
                        status: 'PUBLISHED',
                    },
                    include: publicPostInclude,
                });

                if (sourcePost) {
                    const error = new NotFoundError('Translation not found');
                    error.details = {
                        code: 'TRANSLATION_NOT_FOUND',
                        locale: resolvedLocale,
                        sourceLocale: DEFAULT_LOCALE,
                        sourceSlug: sourcePost.slug,
                    };
                    throw error;
                }
            }

            throw new NotFoundError('Post not found');
        }

        await postsRepository.update({
            where: { id: post.id },
            data: { viewCount: { increment: 1 } },
        });

        return serializePosts([post], resolvedLocale)[0];
    }

    /**
     * Create a new post
     */
    async create(dto, authorId, authorRole) {
        const normalizedDto = normalizeEditorPayload(dto);
        const { tagIds, ...postData } = normalizedDto;
        const slug = normalizedDto.slug || generateSlug(normalizedDto.title);
        const uniqueSlug = await this.ensureUniqueSlug(slug);
        const readingTime = buildReadingTime(normalizedDto.content);
        const targetStatus = this.resolveCreatableStatus(normalizedDto.status, authorRole);

        const post = await postsRepository.create({
            data: {
                ...postData,
                slug: uniqueSlug,
                readingTime,
                authorId,
                status: targetStatus,
                rejectionReason: null,
                reviewedAt:
                    targetStatus === 'PUBLISHED' || targetStatus === 'SCHEDULED'
                        ? new Date()
                        : null,
                publishedAt: buildPublishedAt(targetStatus, null),
                tags: buildTagConnect(tagIds),
            },
            include: adminWriteInclude,
        });

        await this.dispatchNewsletterIfNeeded(serializePost(post), {
            hasJustPublished: targetStatus === 'PUBLISHED',
        });

        // Auto-translate to English when published
        if (targetStatus === 'PUBLISHED') {
            this.triggerAutoTranslation(post.id, authorId, authorRole);
        }

        return serializePost(post);
    }

    async importFromNotion(file, authorId, authorRole) {
        const { postData } = await parseNotionExport(file);
        return this.create(postData, authorId, authorRole);
    }

    async generateFeaturedImage(dto) {
        return generateFeaturedImage(dto);
    }

    async enqueueFeaturedImageJob(id, dto, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only edit your own posts');
        }

        const fallbackTagNames = Array.isArray(post.tags)
            ? post.tags.map((tag) => tag.name)
            : [];

        const input = {
            title: dto.title || post.title || '',
            subtitle: dto.subtitle || post.subtitle || post.excerpt || '',
            content: dto.content || post.content || '',
            contentHtml: dto.contentHtml || post.contentHtml || post.content || '',
            categoryName: dto.categoryName || post.category?.name || '',
            tagNames: Array.isArray(dto.tagNames) && dto.tagNames.length > 0
                ? dto.tagNames
                : fallbackTagNames,
        };

        return thumbnailGenerationService.enqueueJob({
            postId: id,
            requestedById: userId,
            input,
        });
    }

    async getLatestFeaturedImageJob(id, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only edit your own posts');
        }

        return thumbnailGenerationService.getLatestJob(id);
    }

    async upsertTranslation(id, dto, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only edit your own posts');
        }

        const normalizedDto = normalizeTranslationPayload(dto);
        const { locale } = normalizedDto;

        if (isDefaultLocale(locale)) {
            throw new ForbiddenError('Vietnamese content is edited on the base post');
        }

        const existingTranslation = await postsRepository.findUniqueTranslation({
            where: {
                postId_locale: {
                    postId: id,
                    locale,
                },
            },
        });

        const baseSlug = normalizedDto.slug?.trim() || generateSlug(normalizedDto.title);
        const slug = await this.ensureUniqueTranslationSlug(baseSlug, locale, existingTranslation?.id);
        const targetStatus = this.resolveEditableStatus(normalizedDto.status, userRole) || 'DRAFT';

        const translation = await postsRepository.upsertTranslation({
            where: {
                postId_locale: {
                    postId: id,
                    locale,
                },
            },
            update: {
                ...normalizedDto,
                slug,
                locale,
                status: targetStatus,
                publishedAt: buildPublishedAt(targetStatus, existingTranslation?.publishedAt || null),
            },
            create: {
                postId: id,
                ...normalizedDto,
                slug,
                locale,
                status: targetStatus,
                publishedAt: buildPublishedAt(targetStatus, null),
            },
        });

        return translation;
    }

    /**
     * Batch auto-translate: enqueue a translation job for each published post
     * that has no EN translation yet. Jobs run in the background in parallel
     * (bounded by the in-process worker); this call returns immediately with
     * the list of enqueued job ids so the UI can poll each one.
     */
    async batchAutoTranslate(userId, userRole, { limit = 5 } = {}) {
        if (!['ADMIN', 'EDITOR', 'MODERATOR'].includes(userRole)) {
            throw new ForbiddenError('Only editorial roles can batch-translate posts');
        }

        const postsWithoutEnglish = await postsRepository.findMany({
            where: {
                status: 'PUBLISHED',
                NOT: {
                    translations: {
                        some: { locale: 'en' },
                    },
                },
            },
            take: limit,
            orderBy: { publishedAt: 'desc' },
            include: {
                translations: {
                    where: { locale: 'en' },
                    take: 1,
                },
            },
        });

        const results = [];

        for (const post of postsWithoutEnglish) {
            const hasAnyEnTranslation = post.translations?.length > 0;

            if (hasAnyEnTranslation) {
                results.push({
                    id: post.id,
                    slug: post.slug,
                    status: 'skipped',
                    reason: 'EN translation already exists',
                });
                continue;
            }

            try {
                const job = await translationJobsService.enqueueJob({
                    postId: post.id,
                    userId,
                    userRole,
                    locale: 'en',
                });
                results.push({
                    id: post.id,
                    slug: post.slug,
                    status: 'queued',
                    jobId: job.id,
                });
            } catch (error) {
                results.push({
                    id: post.id,
                    slug: post.slug,
                    status: 'failed',
                    error: error.message,
                });
            }
        }

        return {
            total: postsWithoutEnglish.length,
            results,
        };
    }

    /**
     * Fire-and-forget: auto-translate a post to English in the background.
     * Called automatically when a post transitions to PUBLISHED status.
     * Delegates to the translation-jobs service so progress is persisted and
     * visible in the admin UI instead of being silently lost on process restart.
     */
    triggerAutoTranslation(postId, userId, userRole) {
        setImmediate(async () => {
            try {
                const existing = await postsRepository.findFirstTranslation({
                    where: { postId, locale: 'en' },
                });

                if (existing) {
                    console.log(
                        `[AutoTranslate] Skipped ${postId}: EN translation already exists`
                    );
                    return;
                }

                console.log(
                    `[AutoTranslate] Enqueuing background translation job for post ${postId}`
                );
                await translationJobsService.enqueueJob({
                    postId,
                    userId,
                    userRole,
                    locale: 'en',
                });
            } catch (error) {
                console.error(
                    `[AutoTranslate] Failed to enqueue background translation for ${postId}:`,
                    error.message
                );
            }
        });
    }

    /**
     * Update a post
     */
    async update(id, dto, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only edit your own posts');
        }

        const normalizedDto = normalizeEditorPayload(dto);
        const { tagIds, createVersion = true, ...postData } = normalizedDto;
        const hasExplicitSlug =
            typeof normalizedDto.slug === 'string' && normalizedDto.slug.trim().length > 0;

        let slug = post.slug;
        if (hasExplicitSlug) {
            slug = await this.ensureUniqueSlug(normalizedDto.slug.trim(), id);
        } else if (normalizedDto.title && normalizedDto.title !== post.title) {
            slug = await this.ensureUniqueSlug(generateSlug(normalizedDto.title), id);
        }

        let readingTime = post.readingTime;
        if (normalizedDto.content) {
            readingTime = buildReadingTime(normalizedDto.content);
        }

        const nextStatus = this.resolveEditableStatus(normalizedDto.status, userRole);
        const publishedAt = buildPublishedAt(nextStatus, post.publishedAt);
        const hasJustPublished = nextStatus === 'PUBLISHED' && post.status !== 'PUBLISHED';

        if (createVersion) {
            await this.createVersionSnapshot(post, userId, 'Manual update');
        }

        const updatedPost = await postsRepository.update({
            where: { id },
            data: {
                ...postData,
                slug,
                readingTime,
                status: nextStatus,
                publishedAt,
                reviewedAt:
                    nextStatus === 'PUBLISHED' || nextStatus === 'SCHEDULED'
                        ? new Date()
                        : nextStatus === 'REVIEW'
                          ? null
                          : post.reviewedAt ?? null,
                rejectionReason:
                    nextStatus === 'REVIEW' || nextStatus === 'PUBLISHED' || nextStatus === 'SCHEDULED'
                        ? null
                        : post.rejectionReason ?? null,
                tags: buildTagReplace(tagIds),
            },
            include: adminWriteInclude,
        });

        const serializedUpdatedPost = serializePost(updatedPost);
        await this.dispatchNewsletterIfNeeded(serializedUpdatedPost, { hasJustPublished });

        // Auto-translate to English when post just got published
        if (hasJustPublished) {
            this.triggerAutoTranslation(id, userId, userRole);
        }

        return serializedUpdatedPost;
    }

    /**
     * Delete a post
     */
    async delete(id, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only delete your own posts');
        }

        await postsRepository.delete({ where: { id } });

        return { message: 'Post deleted successfully' };
    }

    /**
     * Get post statistics for dashboard
     */
    async getStats() {
        const [total, statusStats, recentPosts] = await Promise.all([
            postsRepository.count(),
            postsRepository.groupBy({
                by: ['status'],
                _count: true,
            }),
            postsRepository.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: statsRecentPostsSelect,
            }),
        ]);

        const totalViews = await postsRepository.aggregate({
            _sum: { viewCount: true },
        });

        return {
            total,
            totalViews: totalViews._sum.viewCount || 0,
            byStatus: statusStats.reduce((acc, curr) => {
                acc[curr.status] = curr._count;
                return acc;
            }, {}),
            recentPosts: serializePosts(recentPosts),
        };
    }

    /**
     * Get related posts based on category and tags
     */
    async getRelated(postId, limit = 3, locale = DEFAULT_LOCALE) {
        const post = await postsRepository.findUnique({
            where: { id: postId },
            include: { tags: true },
        });

        if (!post) return [];

        const posts = await postsRepository.findMany({
            where: {
                id: { not: postId },
                status: 'PUBLISHED',
                OR: [
                    { categoryId: post.categoryId },
                    {
                        tags: {
                            some: {
                                id: { in: post.tags.map((t) => t.id) },
                            },
                        },
                    },
                ],
                ...(!isDefaultLocale(locale) && {
                    translations: {
                        some: {
                            locale,
                            status: 'PUBLISHED',
                        },
                    },
                }),
            },
            take: limit,
            orderBy: { viewCount: 'desc' },
            include: relatedPostsInclude,
        });

        return serializePosts(posts, locale);
    }

    async submitForReview(id, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You can only submit your own posts for review');
        }

        await this.createVersionSnapshot(post, userId, 'Submitted for review');

        const updatedPost = await postsRepository.update({
            where: { id },
            data: {
                status: 'REVIEW',
                rejectionReason: null,
                reviewedAt: null,
                publishedAt: null,
            },
            include: adminWriteInclude,
        });

        const serializedUpdatedPost = serializePost(updatedPost);
        await this.dispatchNewsletterIfNeeded(serializedUpdatedPost, {
            hasJustPublished: false,
        });

        return serializedUpdatedPost;
    }

    async approve(id, userId, userRole, status = 'PUBLISHED') {
        const post = await this.findById(id);

        if (!['ADMIN', 'EDITOR', 'MODERATOR'].includes(userRole)) {
            throw new ForbiddenError('Only editorial roles can approve posts');
        }

        const targetStatus = status === 'SCHEDULED' ? 'SCHEDULED' : 'PUBLISHED';
        await this.createVersionSnapshot(post, userId, `Approved as ${targetStatus}`);
        const updatedPost = await postsRepository.update({
            where: { id },
            data: {
                status: targetStatus,
                rejectionReason: null,
                reviewedAt: new Date(),
                publishedAt: buildPublishedAt(targetStatus, post.publishedAt),
            },
            include: adminWriteInclude,
        });

        // Auto-translate to English when approved as PUBLISHED
        if (targetStatus === 'PUBLISHED') {
            this.triggerAutoTranslation(id, userId, userRole);
        }

        return serializePost(updatedPost);
    }

    async reject(id, rejectionReason, userRole) {
        const post = await this.findById(id);

        if (!['ADMIN', 'EDITOR', 'MODERATOR'].includes(userRole)) {
            throw new ForbiddenError('Only editorial roles can reject posts');
        }

        await this.createVersionSnapshot(post, null, 'Rejected during review');

        const updatedPost = await postsRepository.update({
            where: { id },
            data: {
                status: 'DRAFT',
                rejectionReason,
                reviewedAt: new Date(),
                publishedAt: null,
            },
            include: adminWriteInclude,
        });

        return serializePost(updatedPost);
    }

    async processScheduledPublications() {
        const duePosts = await postsRepository.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: {
                    lte: new Date(),
                },
            },
            include: adminWriteInclude,
            take: 25,
        });

        if (duePosts.length === 0) {
            return { publishedCount: 0 };
        }

        const now = new Date();
        let publishedCount = 0;

        for (const duePost of duePosts) {
            const updatedPost = await postsRepository.update({
                where: { id: duePost.id },
                data: {
                    status: 'PUBLISHED',
                    publishedAt: now,
                    reviewedAt: now,
                    rejectionReason: null,
                },
                include: adminWriteInclude,
            });

            publishedCount += 1;
            await this.dispatchNewsletterIfNeeded(serializePost(updatedPost), {
                hasJustPublished: true,
            });

            // Auto-translate scheduled posts when they go live
            this.triggerAutoTranslation(duePost.id, duePost.authorId, 'ADMIN');
        }

        return {
            publishedCount,
        };
    }

    async listVersions(id, userId, userRole) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You do not have access to this post history');
        }

        const versions = await postsRepository.findManyVersions({
            where: { postId: id },
            orderBy: { createdAt: 'desc' },
            select: postVersionListSelect,
            take: 3,
        });

        return serializeVersions(versions);
    }

    async restoreVersion(id, versionId, userId, userRole, reason) {
        const post = await this.findById(id);

        if (!this.canEditPost(post, userId, userRole)) {
            throw new ForbiddenError('You do not have access to restore this post');
        }

        const version = await postsRepository.findUniqueVersion({
            where: { id: versionId },
        });

        if (!version || version.postId !== id) {
            throw new NotFoundError('Post version not found');
        }

        await this.createVersionSnapshot(post, userId, reason || `Rollback to version ${versionId}`);

        const targetStatus = this.resolveEditableStatus(version.status, userRole);

        const restoredPost = await postsRepository.update({
            where: { id },
            data: {
                title: version.title,
                slug: version.slug,
                subtitle: version.subtitle,
                excerpt: version.excerpt,
                content: version.content,
                contentHtml: version.contentHtml,
                contentJson: version.contentJson,
                featuredImage: version.featuredImage,
                status: targetStatus,
                scheduledAt: version.scheduledAt,
                rejectionReason: version.rejectionReason,
                categoryId: version.categoryId,
                readingTime: buildReadingTime(version.contentHtml || version.content),
                publishedAt: buildPublishedAt(targetStatus, post.publishedAt),
                tags: {
                    set: [],
                    connect: Array.isArray(version.tagIds)
                        ? version.tagIds.map((tagId) => ({ id: tagId }))
                        : [],
                },
            },
            include: adminWriteInclude,
        });

        return serializePost(restoredPost);
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    async createVersionSnapshot(post, createdById, reason) {
        const tagIds = Array.isArray(post.tags) ? post.tags.map((tag) => tag.id) : [];
        const snapshot = await postsRepository.createVersion({
            data: {
                postId: post.id,
                title: post.title,
                slug: post.slug,
                subtitle: post.subtitle ?? null,
                excerpt: post.excerpt ?? null,
                content: post.content || '',
                contentHtml: post.contentHtml || post.content || '',
                contentJson: post.contentJson ?? null,
                featuredImage: post.featuredImage ?? null,
                status: post.status,
                scheduledAt: post.scheduledAt ?? null,
                rejectionReason: post.rejectionReason ?? null,
                categoryId: post.category?.id ?? post.categoryId ?? null,
                tagIds,
                createdById: createdById ?? null,
                reason: reason || null,
            },
        });

        await this.pruneVersionHistory(post.id);

        return snapshot;
    }

    async pruneVersionHistory(postId, retain = 3) {
        const overflowVersions = await postsRepository.findManyVersions({
            where: { postId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
            skip: retain,
        });

        if (overflowVersions.length === 0) {
            return;
        }

        await postsRepository.deleteManyVersions({
            where: {
                id: {
                    in: overflowVersions.map((version) => version.id),
                },
            },
        });
    }

    async dispatchNewsletterIfNeeded(post, { hasJustPublished }) {
        if (!hasJustPublished || !post || post.newsletterSentAt) {
            return;
        }

        try {
            const result = await subscribersService.dispatchPublishedPostNewsletter(post);

            if (!result?.skipped) {
                await postsRepository.update({
                    where: { id: post.id },
                    data: { newsletterSentAt: new Date() },
                });
            }
        } catch (error) {
            console.error(`Failed to dispatch newsletter for post ${post.id}:`, error);
        }
    }

    canEditPost(post, userId, userRole) {
        if (['ADMIN', 'EDITOR', 'MODERATOR'].includes(userRole)) {
            return true;
        }

        return post.authorId === userId;
    }

    resolveEditableStatus(status, userRole) {
        if (!status) {
            return undefined;
        }

        if (['ADMIN', 'EDITOR', 'MODERATOR'].includes(userRole)) {
            return status;
        }

        if (status === 'PUBLISHED' || status === 'SCHEDULED') {
            return 'REVIEW';
        }

        return status;
    }

    resolveCreatableStatus(status, userRole) {
        if (!status) {
            return 'DRAFT';
        }

        if (['ADMIN', 'EDITOR', 'MODERATOR'].includes(userRole)) {
            return status;
        }

        if (status === 'PUBLISHED' || status === 'SCHEDULED') {
            return 'REVIEW';
        }

        return status;
    }

    async ensureUniqueSlug(slug, excludeId) {
        let uniqueSlug = slug;
        let counter = 1;

        while (true) {
            const existing = await postsRepository.findUnique({
                where: { slug: uniqueSlug },
            });

            if (!existing || existing.id === excludeId) {
                break;
            }

            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }

        return uniqueSlug;
    }

    async ensureUniqueTranslationSlug(slug, locale, excludeTranslationId) {
        let uniqueSlug = slug;
        let counter = 1;

        while (true) {
            const existing = await postsRepository.findFirstTranslation({
                where: {
                    locale,
                    slug: uniqueSlug,
                },
            });

            if (!existing || existing.id === excludeTranslationId) {
                break;
            }

            uniqueSlug = `${slug}-${counter}`;
            counter += 1;
        }

        return uniqueSlug;
    }
}

module.exports = new PostsService();
