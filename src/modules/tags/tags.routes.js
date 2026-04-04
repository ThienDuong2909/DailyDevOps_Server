const express = require('express');
const tagsService = require('./tags.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { sendCreated, sendOk } = require('../../common/http/responses');
const { createTagSchema, tagIdParamSchema, updateTagSchema } = require('./tags.validation');
const asyncHandler = require('express-async-handler');

const router = express.Router();

router.get(
    '/',
    asyncHandler(async (req, res) => {
        const tags = await tagsService.findAll();
        return sendOk(res, { data: tags });
    })
);

router.get(
    '/:id',
    validate(tagIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const tag = await tagsService.findById(req.params.id);
        return sendOk(res, { data: tag });
    })
);

router.post(
    '/',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(createTagSchema),
    asyncHandler(async (req, res) => {
        const tag = await tagsService.create(req.body);
        return sendCreated(res, { data: tag });
    })
);

router.put(
    '/:id',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(tagIdParamSchema, 'params'),
    validate(updateTagSchema),
    asyncHandler(async (req, res) => {
        const tag = await tagsService.update(req.params.id, req.body);
        return sendOk(res, { data: tag });
    })
);

router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(tagIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const result = await tagsService.delete(req.params.id);
        return sendOk(res, { ...result });
    })
);

module.exports = router;
