const express = require('express');
const asyncHandler = require('express-async-handler');
const analyticsService = require('./analytics.service');
const {
    trackAnalyticsEventSchema,
    analyticsOverviewQuerySchema,
} = require('./analytics.validation');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { sendCreated, sendOk } = require('../../common/http/responses');

const router = express.Router();

router.post(
    '/events',
    validate(trackAnalyticsEventSchema),
    asyncHandler(async (req, res) => {
        const result = await analyticsService.trackEvent({
            eventType: req.body.eventType,
            payload: req.body.payload || {},
            req,
        });

        return sendCreated(res, { data: result });
    })
);

router.get(
    '/overview',
    authenticate,
    authorize('ADMIN', 'MODERATOR', 'EDITOR'),
    validate(analyticsOverviewQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await analyticsService.getOverview(req.query);
        return sendOk(res, { data: result });
    })
);

module.exports = router;
