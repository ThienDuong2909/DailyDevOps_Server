const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPrismaClient } = require('../../utils/prisma');
const {
    UnauthorizedError,
    ConflictError,
    BadRequestError
} = require('../../middlewares/error.middleware');

const prisma = getPrismaClient();

class AuthService {
    /**
     * Register a new user
     */
    async register(dto) {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictError('Email already registered');
        }

        // Hash password
        const hashedPassword = await this.hashData(dto.password);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
            },
        });

        // Generate tokens
        const tokens = await this.generateTokens({
            sub: user.id,
            email: user.email,
            role: user.role,
        });

        // Save refresh token hash
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    /**
     * Login user
     */
    async login(dto) {
        const user = await prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedError('Account is deactivated');
        }

        // Verify password
        const passwordValid = await argon2.verify(user.password, dto.password);
        if (!passwordValid) {
            throw new UnauthorizedError('Invalid credentials');
        }

        // Generate tokens
        const tokens = await this.generateTokens({
            sub: user.id,
            email: user.email,
            role: user.role,
        });

        // Update refresh token and last login
        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken: await this.hashData(tokens.refreshToken),
                lastLoginAt: new Date(),
            },
        });

        return tokens;
    }

    /**
     * Logout user - invalidate refresh token
     */
    async logout(userId) {
        await prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshTokens(userId, refreshToken) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || !user.refreshToken) {
            throw new UnauthorizedError('Access denied');
        }

        // Verify refresh token
        const refreshTokenValid = await argon2.verify(user.refreshToken, refreshToken);
        if (!refreshTokenValid) {
            throw new UnauthorizedError('Access denied');
        }

        // Generate new tokens
        const tokens = await this.generateTokens({
            sub: user.id,
            email: user.email,
            role: user.role,
        });

        // Update refresh token
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    /**
     * Get current user profile
     */
    async getProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                bio: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        return user;
    }

    /**
     * Generate access and refresh tokens
     */
    async generateTokens(payload) {
        const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
            expiresIn: config.jwt.accessExpiresIn,
        });

        const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
            expiresIn: config.jwt.refreshExpiresIn,
        });

        return {
            accessToken,
            refreshToken,
            accessTokenExpires: this.getTokenExpiration(config.jwt.accessExpiresIn),
        };
    }

    /**
     * Update refresh token in database
     */
    async updateRefreshToken(userId, refreshToken) {
        const hashedRefreshToken = await this.hashData(refreshToken);
        await prisma.user.update({
            where: { id: userId },
            data: { refreshToken: hashedRefreshToken },
        });
    }

    /**
     * Hash data using Argon2
     */
    async hashData(data) {
        return argon2.hash(data);
    }

    /**
     * Calculate token expiration timestamp
     */
    getTokenExpiration(expiresIn) {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) return Date.now() + 15 * 60 * 1000; // Default 15 minutes

        const value = parseInt(match[1], 10);
        const unit = match[2];

        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };

        return Date.now() + value * (multipliers[unit] || 60 * 1000);
    }
}

module.exports = new AuthService();
