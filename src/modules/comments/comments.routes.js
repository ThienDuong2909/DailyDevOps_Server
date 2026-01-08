const express = require('express');
const commentsService = require('./comments.service');
const { authenticate, optionalAuth, authorize } = require('../../middlewares/auth.middleware');
const asyncHandler = require('express-async-handler');

const router = express.Router();

/**
 * @route   GET /api/comments/post/:postId
 * @desc    Get comments by post ID
 * @access  Public
 */
router.get(
    '/post/:postId',
    asyncHandler(async (req, res) => {
        const comments = await commentsService.findByPostId(req.params.postId);
        res.status(200).json({ success: true, data: comments });
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
    asyncHandler(async (req, res) => {
        const userId = req.user?.id;
        const comment = await commentsService.create(req.body, userId, req);
        res.status(201).json({ success: true, data: comment });
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
    asyncHandler(async (req, res) => {
        const { status } = req.body;
        const comment = await commentsService.updateStatus(
            req.params.id,
            status,
            req.user.id,
            req.user.role
        );
        res.status(200).json({ success: true, data: comment });
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
    asyncHandler(async (req, res) => {
        const result = await commentsService.delete(
            req.params.id,
            req.user.id,
            req.user.role
        );
        res.status(200).json({ success: true, ...result });
    })
);

module.exports = router;
