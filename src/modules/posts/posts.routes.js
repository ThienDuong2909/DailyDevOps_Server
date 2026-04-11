const express = require('express');
const multer = require('multer');
const postsService = require('./posts.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, optionalAuth, authorize } = require('../../middlewares/auth.middleware');
const {
    createPostSchema,
    updatePostSchema,
    queryPostSchema,
    autocompletePostSchema,
    rejectPostSchema,
    postIdParamSchema,
    restoreVersionSchema,
    versionParamsSchema,
    generateFeaturedImageSchema,
    enqueueFeaturedImageJobSchema,
} = require('./posts.validation');
const { sendCreated, sendOk } = require('../../common/http/responses');
const asyncHandler = require('express-async-handler');
const { BadRequestError } = require('../../middlewares/error.middleware');

const router = express.Router();
const MAX_NOTION_IMPORT_SIZE_BYTES = 25 * 1024 * 1024;
const notionImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_NOTION_IMPORT_SIZE_BYTES,
        files: 1,
        fields: 2,
        parts: 3,
    },
});

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

router.get(
    '/search',
    validate(queryPostSchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await postsService.findPublished(req.query);
        return sendOk(res, {
            ...result,
        });
    })
);

router.get(
    '/autocomplete',
    validate(autocompletePostSchema, 'query'),
    asyncHandler(async (req, res) => {
        const suggestions = await postsService.autocomplete(req.query);
        return sendOk(res, {
            data: suggestions,
        });
    })
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/posts
 * @desc    Get all posts (Admin)
 * @access  Private (ADMIN, MODERATOR, EDITOR, AUTHOR)
 */
router.get(
    '/',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    validate(queryPostSchema, 'query'),
    asyncHandler(async (req, res) => {
        const scopedQuery =
            req.user.role === 'AUTHOR'
                ? { ...req.query, authorId: req.user.id }
                : req.query;
        const result = await postsService.findAll(scopedQuery);
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
 * @access  Private (ADMIN, MODERATOR, EDITOR, AUTHOR)
 */
router.get(
    '/:id',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    validate(postIdParamSchema, 'params'),
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
 * @access  Private (ADMIN, EDITOR, AUTHOR)
 */
router.post(
    '/import/notion',
    authenticate,
    authorize('ADMIN', 'EDITOR', 'AUTHOR'),
    notionImportUpload.single('file'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new BadRequestError('Notion export zip is required');
        }

        const post = await postsService.importFromNotion(req.file, req.user.id, req.user.role);
        return sendCreated(res, {
            data: post,
        });
    })
);

router.post(
    '/generate-featured-image',
    authenticate,
    authorize('ADMIN', 'EDITOR', 'AUTHOR'),
    validate(generateFeaturedImageSchema),
    asyncHandler(async (req, res) => {
        const result = await postsService.generateFeaturedImage(req.body);
        return sendOk(res, {
            data: result,
        });
    })
);

router.get(
    '/:id/thumbnail-jobs/latest',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    validate(postIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const result = await postsService.getLatestFeaturedImageJob(
            req.params.id,
            req.user.id,
            req.user.role
        );
        return sendOk(res, {
            data: result,
        });
    })
);

router.post(
    '/:id/thumbnail-jobs',
    authenticate,
    authorize('ADMIN', 'EDITOR', 'AUTHOR'),
    validate(postIdParamSchema, 'params'),
    validate(enqueueFeaturedImageJobSchema),
    asyncHandler(async (req, res) => {
        const result = await postsService.enqueueFeaturedImageJob(
            req.params.id,
            req.body,
            req.user.id,
            req.user.role
        );
        return sendCreated(res, {
            data: result,
        });
    })
);

router.post(
    '/',
    authenticate,
    authorize('ADMIN', 'EDITOR', 'AUTHOR'),
    validate(createPostSchema),
    asyncHandler(async (req, res) => {
        const post = await postsService.create(req.body, req.user.id, req.user.role);
        return sendCreated(res, {
            data: post,
        });
    })
);

/**
 * @route   PUT /api/posts/:id
 * @desc    Update post
 * @access  Private (ADMIN, MODERATOR, EDITOR, AUTHOR)
 */
router.put(
    '/:id',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
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
 * @access  Private (ADMIN, MODERATOR, EDITOR, AUTHOR)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
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

router.get(
    '/:id/versions',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    validate(postIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const versions = await postsService.listVersions(
            req.params.id,
            req.user.id,
            req.user.role
        );
        return sendOk(res, { data: versions });
    })
);

router.post(
    '/:id/versions/:versionId/restore',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    validate(versionParamsSchema, 'params'),
    validate(restoreVersionSchema),
    asyncHandler(async (req, res) => {
        const post = await postsService.restoreVersion(
            req.params.id,
            req.params.versionId,
            req.user.id,
            req.user.role,
            req.body.reason
        );
        return sendOk(res, { data: post });
    })
);

router.post(
    '/:id/submit-review',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR'),
    asyncHandler(async (req, res) => {
        const post = await postsService.submitForReview(
            req.params.id,
            req.user.id,
            req.user.role
        );
        return sendOk(res, { data: post });
    })
);

router.post(
    '/:id/approve',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR'),
    asyncHandler(async (req, res) => {
        const post = await postsService.approve(
            req.params.id,
            req.user.id,
            req.user.role,
            req.body?.status
        );
        return sendOk(res, { data: post });
    })
);

router.post(
    '/:id/reject',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR'),
    validate(rejectPostSchema),
    asyncHandler(async (req, res) => {
        const post = await postsService.reject(
            req.params.id,
            req.body.rejectionReason,
            req.user.role
        );
        return sendOk(res, { data: post });
    })
);

module.exports = router;
