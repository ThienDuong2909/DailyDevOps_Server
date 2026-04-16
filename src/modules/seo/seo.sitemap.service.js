const { getPrismaClient } = require('../../database/prisma');
const { DEFAULT_LOCALE, isDefaultLocale, normalizeLocale } = require('../posts/posts.helpers');

const prisma = getPrismaClient();

class SitemapService {
    buildLocaleAlternates(post, translations = []) {
        const alternates = {
            [DEFAULT_LOCALE]: post.slug,
        };

        translations.forEach((translation) => {
            if (translation?.locale && translation?.slug && translation.status === 'PUBLISHED') {
                alternates[translation.locale] = translation.slug;
            }
        });

        return alternates;
    }

    /**
     * Get all published posts for sitemap generation.
     * Returns only the fields needed: slug, updatedAt, publishedAt, featuredImage.
     */
    async getPublishedPostsForSitemap(locale = DEFAULT_LOCALE) {
        const resolvedLocale = normalizeLocale(locale);
        const posts = await prisma.post.findMany({
            where: {
                status: 'PUBLISHED',
                ...(!isDefaultLocale(resolvedLocale) && {
                    translations: {
                        some: {
                            locale: resolvedLocale,
                            status: 'PUBLISHED',
                        },
                    },
                }),
            },
            select: {
                slug: true,
                updatedAt: true,
                publishedAt: true,
                featuredImage: true,
                translations: {
                    where: {
                        locale: resolvedLocale,
                        status: 'PUBLISHED',
                    },
                    select: {
                        slug: true,
                        featuredImage: true,
                    },
                    take: 1,
                },
                category: {
                    select: { slug: true },
                },
            },
            orderBy: { publishedAt: 'desc' },
        });

        if (isDefaultLocale(resolvedLocale)) {
            return posts;
        }

        return posts
            .map((post) => {
                const translation = Array.isArray(post.translations) ? post.translations[0] : null;
                if (!translation?.slug) {
                    return null;
                }

                return {
                    ...post,
                    slug: translation.slug,
                    featuredImage: translation.featuredImage || post.featuredImage,
                };
            })
            .filter(Boolean);
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
    async getPostSeoBySlug(slug, locale = DEFAULT_LOCALE) {
        const resolvedLocale = normalizeLocale(locale);
        const baseSelect = {
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
            translations: {
                select: {
                    locale: true,
                    slug: true,
                    title: true,
                    excerpt: true,
                    featuredImage: true,
                    metaTitle: true,
                    metaDescription: true,
                    canonicalUrl: true,
                    ogImage: true,
                    noIndex: true,
                    noFollow: true,
                    focusKeywords: true,
                    status: true,
                },
            },
        };

        if (isDefaultLocale(resolvedLocale)) {
            const post = await prisma.post.findFirst({
                where: {
                    slug,
                    status: 'PUBLISHED',
                },
                select: baseSelect,
            });

            if (!post) {
                return null;
            }

            return {
                ...post,
                localeAlternates: this.buildLocaleAlternates(post, post.translations || []),
            };
        }

        const translation = await prisma.postTranslation.findFirst({
            where: {
                locale: resolvedLocale,
                slug,
                status: 'PUBLISHED',
                post: {
                    status: 'PUBLISHED',
                },
            },
            select: {
                locale: true,
                title: true,
                slug: true,
                excerpt: true,
                featuredImage: true,
                metaTitle: true,
                metaDescription: true,
                canonicalUrl: true,
                ogImage: true,
                noIndex: true,
                noFollow: true,
                focusKeywords: true,
                post: {
                    select: baseSelect,
                },
            },
        });

        if (!translation?.post) {
            return null;
        }

        return {
            ...translation.post,
            locale: resolvedLocale,
            title: translation.title,
            slug: translation.slug,
            excerpt: translation.excerpt || translation.post.excerpt,
            featuredImage: translation.featuredImage || translation.post.featuredImage,
            seoSetting: {
                ...translation.post.seoSetting,
                metaTitle: translation.metaTitle || translation.post.seoSetting?.metaTitle || null,
                metaDescription:
                    translation.metaDescription || translation.post.seoSetting?.metaDescription || null,
                canonicalUrl: translation.canonicalUrl || translation.post.seoSetting?.canonicalUrl || null,
                ogImage: translation.ogImage || translation.post.seoSetting?.ogImage || null,
                noIndex:
                    typeof translation.noIndex === 'boolean'
                        ? translation.noIndex
                        : Boolean(translation.post.seoSetting?.noIndex),
                noFollow:
                    typeof translation.noFollow === 'boolean'
                        ? translation.noFollow
                        : Boolean(translation.post.seoSetting?.noFollow),
                focusKeywords:
                    Array.isArray(translation.focusKeywords) && translation.focusKeywords.length > 0
                        ? translation.focusKeywords
                        : translation.post.seoSetting?.focusKeywords || [],
            },
            localeAlternates: this.buildLocaleAlternates(translation.post, translation.post.translations || []),
        };
    }
}

module.exports = new SitemapService();
