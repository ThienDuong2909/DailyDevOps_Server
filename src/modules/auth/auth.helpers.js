const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const config = require('../../config');
const { ConflictError, UnauthorizedError } = require('../../middlewares/error.middleware');

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
    ensureRefreshableUser,
    verifyPassword,
    verifyRefreshToken,
    hashData,
    buildAuthPayload,
    generateTokens,
};
