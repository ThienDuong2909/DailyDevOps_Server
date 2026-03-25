const express = require('express');
const asyncHandler = require('express-async-handler');
const settingsService = require('./settings.service');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { sendOk } = require('../../common/http/responses');
const { settingsSchema } = require('./settings.validation');

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (_req, res) => {
        const settings = await settingsService.getSettings();
        return sendOk(res, { data: settings });
    })
);

router.put(
    '/',
    authenticate,
    authorize('ADMIN'),
    validate(settingsSchema),
    asyncHandler(async (req, res) => {
        const settings = await settingsService.updateSettings(req.body);
        return sendOk(res, { data: settings });
    })
);

module.exports = router;
