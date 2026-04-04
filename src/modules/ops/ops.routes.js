const express = require('express');
const asyncHandler = require('express-async-handler');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const opsService = require('./ops.service');
const { opsExportQuerySchema } = require('./ops.validation');

const router = express.Router();

router.get(
    '/export',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    validate(opsExportQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
        const snapshot = await opsService.exportSnapshot({
            includeDrafts: req.query.includeDrafts,
            includeActivityLogs: req.query.includeActivityLogs,
            user: req.user,
        });

        const suffix = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="devopsdaily-ops-export-${suffix}.json"`
        );

        return res.status(200).send(JSON.stringify(snapshot, null, 2));
    })
);

module.exports = router;
