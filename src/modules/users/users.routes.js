const express = require('express');
const usersService = require('./users.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { sendOk } = require('../../common/http/responses');
const { queryUsersSchema, updateUserSchema, userIdParamSchema } = require('./users.validation');
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
    validate(queryUsersSchema, 'query'),
    asyncHandler(async (req, res) => {
        const result = await usersService.findAll(req.query);
        return sendOk(res, { ...result });
    })
);

router.get(
    '/stats',
    authenticate,
    authorize('ADMIN', 'MODERATOR'),
    asyncHandler(async (_req, res) => {
        const stats = await usersService.getStats();
        return sendOk(res, { data: stats });
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
    validate(userIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const user = await usersService.findById(req.params.id);
        return sendOk(res, { data: user });
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
    validate(userIdParamSchema, 'params'),
    validate(updateUserSchema),
    asyncHandler(async (req, res) => {
        const user = await usersService.update(
            req.params.id,
            req.body,
            req.user.id,
            req.user.role
        );
        return sendOk(res, { data: user });
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
    validate(userIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
        const result = await usersService.delete(
            req.params.id,
            req.user.id,
            req.user.role
        );
        return sendOk(res, { ...result });
    })
);

module.exports = router;
