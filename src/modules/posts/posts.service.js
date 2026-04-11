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
    generateSlug,
    normalizeEditorPayload,
    serializePost,
    serializePosts,
    serializeVersions,
} = require('./posts.helpers');
const { postVersionListSelect } = require('./posts.queries');
const subscribersService = require('../subscribers/subscribers.service');
const { parseNotionExport } = require('./posts.importer');
const { generateFeaturedImage } = require('./posts.image-generator');
const thumbnailGenerationService = require('./posts.thumbnail-generation.service');

class PostsService {
    /**
     * Find all posts with filtering and pagination
     */
    async findAll(query) {
        const { page, limit, skip, where, orderBy } = buildListQuery(query);

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

        return buildPaginatedResponse({ data: serializePosts(posts), total, page, limit });
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

        if (!search) {
            return [];
        }

        const posts = await postsRepository.findMany({
            where: {
                status: 'PUBLISHED',
                OR: [
                    { title: { contains: search } },
                    { excerpt: { contains: search } },
                    { slug: { contains: search } },
                ],
            },
            take: limit,
            orderBy: [
                { publishedAt: 'desc' },
                { createdAt: 'desc' },
            ],
            select: {
                id: true,
                title: true,
                slug: true,
                excerpt: true,
                featuredImage: true,
                publishedAt: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        return posts.map((post) => ({
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

    /**
     * Find post by slug (for public view)
     */
    async findBySlug(slug) {
        const post = await postsRepository.findUnique({
            where: { slug },
            include: publicPostInclude,
        });

        if (!post) {
            throw new NotFoundError('Post not found');
        }

        // Increment view count
        await postsRepository.update({
            where: { id: post.id },
            data: { viewCount: { increment: 1 } },
        });

        return serializePost(post);
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
    async getRelated(postId, limit = 3) {
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
            },
            take: limit,
            orderBy: { viewCount: 'desc' },
            include: relatedPostsInclude,
        });

        return serializePosts(posts);
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
            hasJustPublished: targetStatus === 'PUBLISHED' && post.status !== 'PUBLISHED',
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
}

module.exports = new PostsService();
