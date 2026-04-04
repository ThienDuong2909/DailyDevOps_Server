const express = require('express');
const categoriesService = require('./categories.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { sendCreated, sendOk } = require('../../common/http/responses');
const {
    categoryIdParamSchema,
    createCategorySchema,
    updateCategorySchema,
} = require('./categories.validation');
const asyncHandler = require('express-async-handler');

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const categories = await categoriesService.findAll();
        return sendOk(res, {
            data: categories,
        });
    })
);

/**
 * @route   GET /api/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get(
    '/:id',
    validate(categoryIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const category = await categoriesService.findById(req.params.id);
        return sendOk(res, {
            data: category,
        });
    })
);

/**
 * @route   POST /api/categories
 * @desc    Create category
 * @access  Private (ADMIN, EDITOR)
 */
router.post(
    '/',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(createCategorySchema),
    asyncHandler(async (req, res) => {
        const category = await categoriesService.create(req.body);
        return sendCreated(res, {
            data: category,
        });
    })
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category
 * @access  Private (ADMIN, EDITOR)
 */
router.put(
    '/:id',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(categoryIdParamSchema, 'params'),
    validate(updateCategorySchema),
    asyncHandler(async (req, res) => {
        const category = await categoriesService.update(req.params.id, req.body);
        return sendOk(res, {
            data: category,
        });
    })
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category
 * @access  Private (ADMIN, EDITOR)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN', 'EDITOR'),
    validate(categoryIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const result = await categoriesService.delete(req.params.id);
        return sendOk(res, {
            ...result,
        });
    })
);

module.exports = router;
