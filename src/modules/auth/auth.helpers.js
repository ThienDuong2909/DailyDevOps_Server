const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const config = require('../../config');
const {
    BadRequestError,
    ConflictError,
    UnauthorizedError,
} = require('../../middlewares/error.middleware');

const ensureEmailAvailable = (existingUser) => {
    if (existingUser) {
        throw new ConflictError('Email already registered');
    }
};

const ensureActiveUser = (user) => {
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
        throw new UnauthorizedError('Account is deactivated');
    }
};

const ensureVerifiedUser = (user) => {
    if (!user?.emailVerifiedAt) {
        throw new UnauthorizedError('Please verify your email before signing in');
    }
};

const ensureRefreshableUser = (user) => {
    if (!user || !user.refreshToken) {
        throw new UnauthorizedError('Access denied');
    }
};

const verifyPassword = async (hashedPassword, plainPassword) => {
    const isValid = await argon2.verify(hashedPassword, plainPassword);

    if (!isValid) {
        throw new UnauthorizedError('Invalid credentials');
    }
};

const verifyRefreshToken = async (hashedRefreshToken, refreshToken) => {
    const isValid = await argon2.verify(hashedRefreshToken, refreshToken);

    if (!isValid) {
        throw new UnauthorizedError('Access denied');
    }
};

const hashData = (value) => argon2.hash(value);

const buildAuthPayload = (user) => ({
    sub: user.id,
    email: user.email,
    role: user.role,
});

const createMfaChallengeToken = (user) =>
    jwt.sign(
        {
            sub: user.id,
            email: user.email,
            purpose: 'mfa-login',
        },
        config.jwt.mfaSecret,
        {
            expiresIn: config.jwt.mfaChallengeExpiresIn,
        }
    );

const verifyMfaChallengeToken = (token) => {
    const decoded = jwt.verify(token, config.jwt.mfaSecret);

    if (decoded?.purpose !== 'mfa-login' || !decoded?.sub) {
        throw new UnauthorizedError('MFA challenge is invalid or has expired');
    }

    return decoded;
};

const ensureMfaReady = (user) => {
    if (!user?.mfaEnabled || !user?.mfaSecret) {
        throw new BadRequestError('Multi-factor authentication is not enabled for this account');
    }
};

const ensureMfaSetupInProgress = (user) => {
    if (!user?.mfaTempSecret) {
        throw new BadRequestError('No MFA setup is in progress for this account');
    }
};

const getTokenExpiration = (expiresIn) => {
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
        return Date.now() + 15 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return Date.now() + value * (multipliers[unit] || 60 * 1000);
};

const generateTokens = (payload) => {
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn,
    });

    return {
        accessToken,
        refreshToken,
        accessTokenExpires: getTokenExpiration(config.jwt.accessExpiresIn),
    };
};

module.exports = {
    ensureEmailAvailable,
    ensureActiveUser,
    ensureVerifiedUser,
    ensureRefreshableUser,
    verifyPassword,
    verifyRefreshToken,
    hashData,
    buildAuthPayload,
    generateTokens,
    getTokenExpiration,
    createMfaChallengeToken,
    verifyMfaChallengeToken,
    ensureMfaReady,
    ensureMfaSetupInProgress,
};
