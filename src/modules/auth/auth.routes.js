const express = require('express');
const authService = require('./auth.service');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    resendVerificationSchema,
    changePasswordSchema,
    verifyMfaLoginSchema,
    enableMfaSchema,
    disableMfaSchema,
} = require('./auth.validation');
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
        const result = await authService.register(req.body);

        return sendCreated(res, {
            message: result.message,
            data: {
                verificationToken: result.verificationToken,
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
        const result = await authService.login(req.body);

        if (result.mfaRequired) {
            return sendOk(res, {
                message: 'Authentication code required to finish sign in',
                data: result,
            });
        }

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, refreshTokenCookieOptions);

        return sendOk(res, {
            data: {
                accessToken: result.accessToken,
                accessTokenExpires: result.accessTokenExpires,
            },
        });
    })
);

router.post(
    '/verify-mfa-login',
    validate(verifyMfaLoginSchema),
    asyncHandler(async (req, res) => {
        const tokens = await authService.verifyLoginMfa(req.body.challengeToken, req.body.token);

        res.cookie('refreshToken', tokens.refreshToken, refreshTokenCookieOptions);

        return sendOk(res, {
            data: {
                accessToken: tokens.accessToken,
                accessTokenExpires: tokens.accessTokenExpires,
            },
        });
    })
);

router.post(
    '/verify-email',
    validate(verifyEmailSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.verifyEmail(req.body.token);

        return sendOk(res, {
            message: result.message,
        });
    })
);

router.post(
    '/resend-verification',
    validate(resendVerificationSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.resendVerification(req.body.email);

        return sendOk(res, {
            message: result.message,
            data: {
                verificationToken: result.verificationToken,
            },
        });
    })
);

router.post(
    '/forgot-password',
    validate(forgotPasswordSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.forgotPassword(req.body.email);

        return sendOk(res, {
            message: result.message,
            data: {
                resetToken: result.resetToken,
            },
        });
    })
);

router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.resetPassword(req.body.token, req.body.password);

        return sendOk(res, {
            message: result.message,
        });
    })
);

router.post(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.changePassword(
            req.user.id,
            req.body.currentPassword,
            req.body.newPassword
        );

        res.clearCookie('refreshToken');
        return sendOk(res, {
            message: result.message,
        });
    })
);

router.post(
    '/mfa/setup',
    authenticate,
    asyncHandler(async (req, res) => {
        const result = await authService.setupMfa(req.user.id);

        return sendOk(res, {
            message: 'MFA setup initialized successfully',
            data: result,
        });
    })
);

router.post(
    '/mfa/enable',
    authenticate,
    validate(enableMfaSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.enableMfa(req.user.id, req.body.password, req.body.token);

        return sendOk(res, {
            message: result.message,
        });
    })
);

router.post(
    '/mfa/disable',
    authenticate,
    validate(disableMfaSchema),
    asyncHandler(async (req, res) => {
        const result = await authService.disableMfa(req.user.id, req.body.password, req.body.token);

        res.clearCookie('refreshToken');
        return sendOk(res, {
            message: result.message,
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
