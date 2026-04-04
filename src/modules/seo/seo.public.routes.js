const express = require('express');
const asyncHandler = require('express-async-handler');
const sitemapService = require('./seo.sitemap.service');
const seoService = require('./seo.service');

const router = express.Router();

/**
 * @route   GET /api/v1/seo/sitemap-data
 * @desc    Get all published posts, categories, tags for sitemap generation
 * @access  Public (no auth required — consumed by Next.js sitemap.ts)
 */
router.get(
    '/public-config',
    asyncHandler(async (_req, res) => {
        const config = await seoService.getPublicConfig();

        res.set('Cache-Control', 'public, max-age=300, s-maxage=300');

        return res.json({
            success: true,
            data: config,
        });
    })
);

router.get(
    '/sitemap-data',
    asyncHandler(async (_req, res) => {
        const [posts, categories, tags] = await Promise.all([
            sitemapService.getPublishedPostsForSitemap(),
            sitemapService.getCategoriesForSitemap(),
            sitemapService.getTagsForSitemap(),
        ]);

        // Cache for 1 hour — sitemap data doesn't change frequently
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');

        return res.json({
            success: true,
            data: { posts, categories, tags },
        });
    })
);

/**
 * @route   GET /api/v1/seo/post-meta/:slug
 * @desc    Get SEO metadata for a single post by slug
 * @access  Public (consumed by Next.js generateMetadata)
 */
router.get(
    '/post-meta/:slug',
    asyncHandler(async (req, res) => {
        const post = await sitemapService.getPostSeoBySlug(req.params.slug);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found',
            });
        }

        // Cache for 5 minutes
        res.set('Cache-Control', 'public, max-age=300, s-maxage=300');

        return res.json({
            success: true,
            data: post,
        });
    })
);

module.exports = router;
