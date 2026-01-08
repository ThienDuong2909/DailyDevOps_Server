const express = require('express');
const usersService = require('./users.service');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const asyncHandler = require('express-async-handler');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (ADMIN, MODERATOR)
 */
router.get(
    '/',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    asyncHandler(async (req, res) => {
        const result = await usersService.findAll(req.query);
        res.status(200).json({ success: true, ...result });
    })
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req, res) => {
        const user = await usersService.findById(req.params.id);
        res.status(200).json({ success: true, data: user });
    })
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private
 */
router.put(
    '/:id',
    authenticate,
    asyncHandler(async (req, res) => {
        const user = await usersService.update(
            req.params.id,
            req.body,
            req.user.id,
            req.user.role
        );
        res.status(200).json({ success: true, data: user });
    })
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (ADMIN)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const result = await usersService.delete(
            req.params.id,
            req.user.id,
            req.user.role
        );
        res.status(200).json({ success: true, ...result });
    })
);

module.exports = router;
