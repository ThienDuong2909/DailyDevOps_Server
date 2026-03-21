const express = require('express');
const asyncHandler = require('express-async-handler');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const subscribersService = require('./subscribers.service');
const { subscribeSchema, unsubscribeSchema } = require('./subscribers.validation');

const router = express.Router();

/**
 * POST /api/v1/subscribers
 * @desc Subscribe to newsletter (public)
 */
router.post(
    '/',
    validate(subscribeSchema),
    asyncHandler(async (req, res) => {
        const result = await subscribersService.subscribe(req.body);
        res.status(201).json({
            success: true,
            message: result.message,
            data: result.subscriber,
        });
    })
);

/**
 * POST /api/v1/subscribers/unsubscribe
 * @desc Unsubscribe using token (public)
 */
router.post(
    '/unsubscribe',
    validate(unsubscribeSchema),
    asyncHandler(async (req, res) => {
        const result = await subscribersService.unsubscribe(req.body.token);
        res.json({
            success: true,
            message: result.message,
        });
    })
);

/**
 * GET /api/v1/subscribers
 * @desc Get all subscribers (admin only)
 */
router.get(
    '/',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const { page, limit, isActive } = req.query;
        const result = await subscribersService.findAll({ page, limit, isActive });
        res.json({
            success: true,
            ...result,
        });
    })
);

/**
 * GET /api/v1/subscribers/stats
 * @desc Get subscriber stats (admin only)
 */
router.get(
    '/stats',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const stats = await subscribersService.getStats();
        res.json({
            success: true,
            data: stats,
        });
    })
);

/**
 * DELETE /api/v1/subscribers/:id
 * @desc Delete subscriber (admin only)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        await subscribersService.delete(req.params.id);
        res.json({
            success: true,
            message: 'Subscriber deleted',
        });
    })
);

module.exports = router;
