const express = require('express');
const commentsService = require('./comments.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, optionalAuth, authorize } = require('../../middlewares/auth.middleware');
const { sendCreated, sendOk } = require('../../common/http/responses');
const {
    commentIdParamSchema,
    createCommentSchema,
    postCommentsParamSchema,
    queryCommentsSchema,
    updateCommentStatusSchema,
} = require('./comments.validation');
const asyncHandler = require('express-async-handler');

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    validate(queryCommentsSchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await commentsService.findAll(req.query);
        return sendOk(res, { ...result });
    })
);

router.get(
    '/stats',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    asyncHandler(async (_req, res) => {
        const stats = await commentsService.getStats();
        return sendOk(res, { data: stats });
    })
);

/**
 * @route   GET /api/comments/post/:postId
 * @desc    Get comments by post ID
 * @access  Public
 */
router.get(
    '/post/:postId',
    validate(postCommentsParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const comments = await commentsService.findByPostId(req.params.postId);
        return sendOk(res, { data: comments });
    })
);

/**
 * @route   POST /api/comments
 * @desc    Create comment
 * @access  Public (optionalAuth - có thể comment với hoặc không có account)
 */
router.post(
    '/',
    optionalAuth,
    validate(createCommentSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user?.id;
        const comment = await commentsService.create(req.body, userId, req);
        return sendCreated(res, { data: comment });
    })
);

/**
 * @route   PATCH /api/comments/:id/status
 * @desc    Update comment status
 * @access  Private (ADMIN, MODERATOR)
 */
router.patch(
    '/:id/status',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    validate(commentIdParamSchema, 'params'),
    validate(updateCommentStatusSchema),
    asyncHandler(async (req, res) => {
        const { status } = req.body;
        const comment = await commentsService.updateStatus(
            req.params.id,
            status,
            req.user.id,
            req.user.role
        );
        return sendOk(res, { data: comment });
    })
);

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete comment
 * @access  Private
 */
router.delete(
    '/:id',
    authenticate,
    validate(commentIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const result = await commentsService.delete(
            req.params.id,
            req.user.id,
            req.user.role
        );
        return sendOk(res, { ...result });
    })
);

module.exports = router;
