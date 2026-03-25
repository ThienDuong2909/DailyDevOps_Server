const express = require('express');
const authService = require('./auth.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { registerSchema, loginSchema } = require('./auth.validation');
const { refreshTokenCookieOptions } = require('../../common/http/cookies');
const { sendCreated, sendError, sendOk } = require('../../common/http/responses');
const asyncHandler = require('express-async-handler');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
    '/register',
    validate(registerSchema),
    asyncHandler(async (req, res) => {
        const tokens = await authService.register(req.body);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', tokens.refreshToken, refreshTokenCookieOptions);

        return sendCreated(res, {
            data: {
                accessToken: tokens.accessToken,
                accessTokenExpires: tokens.accessTokenExpires,
            },
        });
    })
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
    '/login',
    validate(loginSchema),
    asyncHandler(async (req, res) => {
        const tokens = await authService.login(req.body);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', tokens.refreshToken, refreshTokenCookieOptions);

        return sendOk(res, {
            data: {
                accessToken: tokens.accessToken,
                accessTokenExpires: tokens.accessTokenExpires,
            },
        });
    })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
    '/logout',
    authenticate,
    asyncHandler(async (req, res) => {
        await authService.logout(req.user.id);

        // Clear refresh token cookie
        res.clearCookie('refreshToken');

        return sendOk(res, {
            message: 'Logged out successfully',
        });
    })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return sendError(res, 401, {
                error: 'No refresh token provided',
            });
        }

        const jwt = require('jsonwebtoken');
        const config = require('../../config');

        // Decode token to get userId
        const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
        const tokens = await authService.refreshTokens(decoded.sub, refreshToken);

        // Set new refresh token in cookie
        res.cookie('refreshToken', tokens.refreshToken, refreshTokenCookieOptions);

        return sendOk(res, {
            data: {
                accessToken: tokens.accessToken,
                accessTokenExpires: tokens.accessTokenExpires,
            },
        });
    })
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
    '/profile',
    authenticate,
    asyncHandler(async (req, res) => {
        const user = await authService.getProfile(req.user.id);

        return sendOk(res, {
            data: user,
        });
    })
);

module.exports = router;
