const express = require('express');
const asyncHandler = require('express-async-handler');
const seoService = require('./seo.service');
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

module.exports = router;
