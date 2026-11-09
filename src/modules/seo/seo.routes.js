const express = require('express');
const asyncHandler = require('express-async-handler');
const seoService = require('./seo.service');
const seoIndexingService = require('./seo.indexing');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { sendOk } = require('../../common/http/responses');
const { updateSeoSchema } = require('./seo.validation');

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (_req, res) => {
        const result = await seoService.getDashboard();
        return sendOk(res, { data: result });
    })
);

router.put(
    '/',
    authenticate,
    authorize('ADMIN'),
    validate(updateSeoSchema),
    asyncHandler(async (req, res) => {
        const result = await seoService.updateDashboard(req.body);
        return sendOk(res, { data: result });
    })
);

router.post(
    '/request-indexing',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const { urls, slug, action } = req.body;
        if (slug) {
            const result = await seoIndexingService.notifyPost(slug, action || 'PUBLISHED');
            return sendOk(res, { data: result });
        }
        if (Array.isArray(urls) && urls.length > 0) {
            const result = await seoIndexingService.notifyIndexNow(urls);
            return sendOk(res, { data: result });
        }
        return sendOk(res, { message: 'No URLs or slug provided' });
    })
);

module.exports = router;
