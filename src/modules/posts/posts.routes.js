const express = require('express');
const postsService = require('./posts.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, optionalAuth, authorize } = require('../../middlewares/auth.middleware');
const { createPostSchema, updatePostSchema, queryPostSchema } = require('./posts.validation');
const asyncHandler = require('express-async-handler');

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   GET /api/posts/published
 * @desc    Get all published posts (public)
 * @access  Public
 */
router.get(
    '/published',
    validate(queryPostSchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await postsService.findPublished(req.query);
        res.status(200).json({
            success: true,
            ...result,
        });
    })
);

/**
 * @route   GET /api/posts/slug/:slug
 * @desc    Get post by slug (public)
 * @access  Public
 */
router.get(
    '/slug/:slug',
    asyncHandler(async (req, res) => {
        const post = await postsService.findBySlug(req.params.slug);
        res.status(200).json({
            success: true,
            data: post,
        });
    })
);

/**
 * @route   GET /api/posts/:id/related
 * @desc    Get related posts
 * @access  Public
 */
router.get(
    '/:id/related',
    asyncHandler(async (req, res) => {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 3;
        const posts = await postsService.getRelated(req.params.id, limit);
        res.status(200).json({
            success: true,
            data: posts,
        });
    })
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/posts
 * @desc    Get all posts (Admin)
 * @access  Private (ADMIN, MODERATOR, EDITOR)
 */
router.get(
    '/',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR'),
    validate(queryPostSchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await postsService.findAll(req.query);
        res.status(200).json({
            success: true,
            ...result,
        });
    })
);

/**
 * @route   GET /api/posts/stats
 * @desc    Get post statistics
 * @access  Private (ADMIN, MODERATOR)
 */
router.get(
    '/stats',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    asyncHandler(async (req, res) => {
        const stats = await postsService.getStats();
        res.status(200).json({
            success: true,
            data: stats,
        });
    })
);

/**
 * @route   GET /api/posts/:id
 * @desc    Get post by ID (Admin)
 * @access  Private (ADMIN, MODERATOR, EDITOR)
 */
router.get(
    '/:id',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR'),
    asyncHandler(async (req, res) => {
        const post = await postsService.findById(req.params.id);
        res.status(200).json({
            success: true,
            data: post,
        });
    })
);

/**
 * @route   POST /api/posts
 * @desc    Create new post
 * @access  Private (ADMIN, EDITOR)
 */
router.post(
    '/',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(createPostSchema),
    asyncHandler(async (req, res) => {
        const post = await postsService.create(req.body, req.user.id);
        res.status(201).json({
            success: true,
            data: post,
        });
    })
);

/**
 * @route   PUT /api/posts/:id
 * @desc    Update post
 * @access  Private (ADMIN, EDITOR)
 */
router.put(
    '/:id',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(updatePostSchema),
    asyncHandler(async (req, res) => {
        const post = await postsService.update(
            req.params.id,
            req.body,
            req.user.id,
            req.user.role
        );
        res.status(200).json({
            success: true,
            data: post,
        });
    })
);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete post
 * @access  Private (ADMIN, EDITOR)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    asyncHandler(async (req, res) => {
        const result = await postsService.delete(
            req.params.id,
            req.user.id,
            req.user.role
        );
        res.status(200).json({
            success: true,
            ...result,
        });
    })
);

module.exports = router;
