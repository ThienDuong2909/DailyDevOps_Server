const express = require('express');
const tagsService = require('./tags.service');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const asyncHandler = require('express-async-handler');

const router = express.Router();

router.get(
    '/',
    asyncHandler(async (req, res) => {
        const tags = await tagsService.findAll();
        res.status(200).json({ success: true, data: tags });
    })
);

router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const tag = await tagsService.findById(req.params.id);
        res.status(200).json({ success: true, data: tag });
    })
);

router.post(
    '/',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const tag = await tagsService.create(req.body);
        res.status(201).json({ success: true, data: tag });
    })
);

router.put(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const tag = await tagsService.update(req.params.id, req.body);
        res.status(200).json({ success: true, data: tag });
    })
);

router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const result = await tagsService.delete(req.params.id);
        res.status(200).json({ success: true, ...result });
    })
);

module.exports = router;
