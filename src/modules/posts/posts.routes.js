const express = require('express');
const postsService = require('./posts.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, optionalAuth, authorize } = require('../../middlewares/auth.middleware');
const { createPostSchema, updatePostSchema, queryPostSchema } = require('./posts.validation');
const { sendCreated, sendOk } = require('../../common/http/responses');
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
        return sendOk(res, {
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
        return sendOk(res, {
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
        return sendOk(res, {
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
        return sendOk(res, {
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
        return sendOk(res, {
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
        return sendOk(res, {
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
        return sendCreated(res, {
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
        return sendOk(res, {
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
        return sendOk(res, {
            ...result,
        });
    })
);

module.exports = router;
