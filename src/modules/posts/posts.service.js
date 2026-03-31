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
} = require('./posts.helpers');

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
    async create(dto, authorId) {
        const normalizedDto = normalizeEditorPayload(dto);
        const { tagIds, ...postData } = normalizedDto;
        const slug = normalizedDto.slug || generateSlug(normalizedDto.title);
        const uniqueSlug = await this.ensureUniqueSlug(slug);
        const readingTime = buildReadingTime(normalizedDto.content);

        const post = await postsRepository.create({
            data: {
                ...postData,
                slug: uniqueSlug,
                readingTime,
                authorId,
                publishedAt: buildPublishedAt(normalizedDto.status, null),
                tags: buildTagConnect(tagIds),
            },
            include: adminWriteInclude,
        });

        return serializePost(post);
    }

    /**
     * Update a post
     */
    async update(id, dto, userId, userRole) {
        const post = await this.findById(id);

        // Check permission: only author or admin can update
        if (post.authorId !== userId && userRole !== 'ADMIN') {
            throw new ForbiddenError('You can only edit your own posts');
        }

        const normalizedDto = normalizeEditorPayload(dto);
        const { tagIds, ...postData } = normalizedDto;

        let slug = post.slug;
        if (normalizedDto.title && normalizedDto.title !== post.title) {
            slug = await this.ensureUniqueSlug(generateSlug(normalizedDto.title), id);
        }

        let readingTime = post.readingTime;
        if (normalizedDto.content) {
            readingTime = buildReadingTime(normalizedDto.content);
        }

        const publishedAt = buildPublishedAt(normalizedDto.status, post.publishedAt);

        const updatedPost = await postsRepository.update({
            where: { id },
            data: {
                ...postData,
                slug,
                readingTime,
                publishedAt,
                tags: buildTagReplace(tagIds),
            },
            include: adminWriteInclude,
        });

        return serializePost(updatedPost);
    }

    /**
     * Delete a post
     */
    async delete(id, userId, userRole) {
        const post = await this.findById(id);

        // Check permission: only author or admin can delete
        if (post.authorId !== userId && userRole !== 'ADMIN') {
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

    // ============================================
    // PRIVATE HELPERS
    // ============================================

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
