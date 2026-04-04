const express = require('express');
const asyncHandler = require('express-async-handler');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { sendOk } = require('../../common/http/responses');
const complianceService = require('./compliance.service');
const { complianceOverviewQuerySchema } = require('./compliance.validation');

const router = express.Router();

router.get(
    '/overview',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    validate(complianceOverviewQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await complianceService.getOverview(req.query);
        return sendOk(res, { data: result });
    })
);

module.exports = router;
