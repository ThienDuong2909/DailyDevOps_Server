const express = require('express');
const asyncHandler = require('express-async-handler');
const { validate } = require('../../middlewares/validation.middleware');
const { sendCreated } = require('../../common/http/responses');
const consentService = require('./consent.service');
const { trackConsentSchema } = require('./consent.validation');

const router = express.Router();

router.post(
    '/',
    validate(trackConsentSchema),
    asyncHandler(async (req, res) => {
        const result = await consentService.trackConsent({
            consentId: req.body.consentId,
            status: req.body.status,
            source: req.body.source,
            preferences: req.body.preferences,
            req,
        });

        return sendCreated(res, {
            data: result,
        });
    })
);

module.exports = router;
