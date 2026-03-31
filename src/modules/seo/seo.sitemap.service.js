const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class SitemapService {
    /**
     * Get all published posts for sitemap generation.
     * Returns only the fields needed: slug, updatedAt, publishedAt, featuredImage.
     */
    async getPublishedPostsForSitemap() {
        return prisma.post.findMany({
            where: { status: 'PUBLISHED' },
            select: {
                slug: true,
                updatedAt: true,
                publishedAt: true,
                featuredImage: true,
                category: {
                    select: { slug: true },
                },
            },
            orderBy: { publishedAt: 'desc' },
        });
    }

    /**
     * Get all categories for sitemap.
     */
    async getCategoriesForSitemap() {
        return prisma.category.findMany({
            select: {
                slug: true,
                updatedAt: true,
                _count: {
                    select: { posts: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Get all tags for sitemap.
     */
    async getTagsForSitemap() {
        return prisma.tag.findMany({
            select: {
                slug: true,
                updatedAt: true,
                _count: {
                    select: { posts: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Get a single published post by slug with SEO data.
     * Used by the client's generateMetadata function.
     */
    async getPostSeoBySlug(slug) {
        return prisma.post.findFirst({
            where: {
                slug,
                status: 'PUBLISHED',
            },
            select: {
                id: true,
                title: true,
                slug: true,
                excerpt: true,
                featuredImage: true,
                publishedAt: true,
                updatedAt: true,
                readingTime: true,
                author: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                category: {
                    select: {
                        name: true,
                        slug: true,
                    },
                },
                tags: {
                    select: { name: true },
                },
                seoSetting: {
                    select: {
                        metaTitle: true,
                        metaDescription: true,
                        canonicalUrl: true,
                        ogImage: true,
                        noIndex: true,
                        noFollow: true,
                        focusKeywords: true,
                    },
                },
            },
        });
    }
}

module.exports = new SitemapService();
