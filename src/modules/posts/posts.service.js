const slugify = require('slugify');
const { getPrismaClient } = require('../../utils/prisma');
const { NotFoundError, ForbiddenError } = require('../../middlewares/error.middleware');

const prisma = getPrismaClient();

class PostsService {
    /**
     * Find all posts with filtering and pagination
     */
    async findAll(query) {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            categoryId,
            authorId,
            tagSlug,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = query;

        const skip = (page - 1) * limit;

        const where = {
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { excerpt: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                ],
            }),
            ...(status && { status }),
            ...(categoryId && { categoryId }),
            ...(authorId && { authorId }),
            ...(tagSlug && {
                tags: {
                    some: { slug: tagSlug },
                },
            }),
        };

        const orderBy = { [sortBy]: sortOrder };

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    author: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            color: true,
                        },
                    },
                    tags: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    _count: {
                        select: { comments: true },
                    },
                },
            }),
            prisma.post.count({ where }),
        ]);

        return {
            data: posts,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
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
        const post = await prisma.post.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        bio: true,
                    },
                },
                category: true,
                tags: true,
                seoSetting: true,
                _count: {
                    select: { comments: true },
                },
            },
        });

        if (!post) {
            throw new NotFoundError('Post not found');
        }

        return post;
    }

    /**
     * Find post by slug (for public view)
     */
    async findBySlug(slug) {
        const post = await prisma.post.findUnique({
            where: { slug },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        bio: true,
                    },
                },
                category: true,
                tags: true,
                seoSetting: true,
                comments: {
                    where: { status: 'APPROVED', parentId: null },
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                avatar: true,
                            },
                        },
                        replies: {
                            where: { status: 'APPROVED' },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        avatar: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!post) {
            throw new NotFoundError('Post not found');
        }

        // Increment view count
        await prisma.post.update({
            where: { id: post.id },
            data: { viewCount: { increment: 1 } },
        });

        return post;
    }

    /**
     * Create a new post
     */
    async create(dto, authorId) {
        const { tagIds, ...postData } = dto;

        // Generate slug if not provided
        const slug = dto.slug || this.generateSlug(dto.title);

        // Ensure slug is unique
        const uniqueSlug = await this.ensureUniqueSlug(slug);

        // Calculate reading time (approx 200 words per minute)
        const wordCount = dto.content.split(/\s+/).length;
        const readingTime = Math.ceil(wordCount / 200);

        return prisma.post.create({
            data: {
                ...postData,
                slug: uniqueSlug,
                readingTime,
                authorId,
                publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
                tags: tagIds?.length
                    ? { connect: tagIds.map((id) => ({ id })) }
                    : undefined,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                category: true,
                tags: true,
            },
        });
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

        const { tagIds, ...postData } = dto;

        // If title changed, regenerate slug
        let slug = post.slug;
        if (dto.title && dto.title !== post.title) {
            slug = await this.ensureUniqueSlug(this.generateSlug(dto.title), id);
        }

        // Recalculate reading time if content changed
        let readingTime = post.readingTime;
        if (dto.content) {
            const wordCount = dto.content.split(/\s+/).length;
            readingTime = Math.ceil(wordCount / 200);
        }

        // Set publishedAt if status changes to PUBLISHED
        let publishedAt = post.publishedAt;
        if (dto.status === 'PUBLISHED' && !post.publishedAt) {
            publishedAt = new Date();
        }

        return prisma.post.update({
            where: { id },
            data: {
                ...postData,
                slug,
                readingTime,
                publishedAt,
                tags: tagIds
                    ? {
                        set: [], // Clear existing tags
                        connect: tagIds.map((tagId) => ({ id: tagId })),
                    }
                    : undefined,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                category: true,
                tags: true,
            },
        });
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

        await prisma.post.delete({ where: { id } });

        return { message: 'Post deleted successfully' };
    }

    /**
     * Get post statistics for dashboard
     */
    async getStats() {
        const [total, statusStats, recentPosts] = await Promise.all([
            prisma.post.count(),
            prisma.post.groupBy({
                by: ['status'],
                _count: true,
            }),
            prisma.post.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    status: true,
                    viewCount: true,
                    createdAt: true,
                    author: {
                        select: { firstName: true, lastName: true },
                    },
                },
            }),
        ]);

        const totalViews = await prisma.post.aggregate({
            _sum: { viewCount: true },
        });

        return {
            total,
            totalViews: totalViews._sum.viewCount || 0,
            byStatus: statusStats.reduce((acc, curr) => {
                acc[curr.status] = curr._count;
                return acc;
            }, {}),
            recentPosts,
        };
    }

    /**
     * Get related posts based on category and tags
     */
    async getRelated(postId, limit = 3) {
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: { tags: true },
        });

        if (!post) return [];

        return prisma.post.findMany({
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
            include: {
                author: {
                    select: { firstName: true, lastName: true, avatar: true },
                },
                category: {
                    select: { name: true, slug: true, color: true },
                },
            },
        });
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    generateSlug(title) {
        return slugify(title, {
            lower: true,
            strict: true,
            locale: 'en',
        });
    }

    async ensureUniqueSlug(slug, excludeId) {
        let uniqueSlug = slug;
        let counter = 1;

        while (true) {
            const existing = await prisma.post.findUnique({
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
