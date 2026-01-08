const express = require('express');
const authService = require('./auth.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { registerSchema, loginSchema } = require('./auth.validation');
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
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(201).json({
            success: true,
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
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({
            success: true,
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

        res.status(200).json({
            success: true,
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
            return res.status(401).json({
                success: false,
                error: 'No refresh token provided',
            });
        }

        const jwt = require('jsonwebtoken');
        const config = require('../../config');

        // Decode token to get userId
        const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
        const tokens = await authService.refreshTokens(decoded.sub, refreshToken);

        // Set new refresh token in cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            success: true,
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

        res.status(200).json({
            success: true,
            data: user,
        });
    })
);

module.exports = router;
