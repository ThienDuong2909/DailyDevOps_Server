const express = require('express');
const categoriesService = require('./categories.service');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
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
        res.status(200).json({
            success: true,
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
    asyncHandler(async (req, res) => {
        const category = await categoriesService.findById(req.params.id);
        res.status(200).json({
            success: true,
            data: category,
        });
    })
);

/**
 * @route   POST /api/categories
 * @desc    Create category
 * @access  Private (ADMIN)
 */
router.post(
    '/',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const category = await categoriesService.create(req.body);
        res.status(201).json({
            success: true,
            data: category,
        });
    })
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category
 * @access  Private (ADMIN)
 */
router.put(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const category = await categoriesService.update(req.params.id, req.body);
        res.status(200).json({
            success: true,
            data: category,
        });
    })
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category
 * @access  Private (ADMIN)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const result = await categoriesService.delete(req.params.id);
        res.status(200).json({
            success: true,
            ...result,
        });
    })
);

module.exports = router;
