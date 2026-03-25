const authRepository = require('./auth.repository');
const { UnauthorizedError } = require('../../middlewares/error.middleware');
const { authProfileSelect } = require('./auth.queries');
const {
    buildAuthPayload,
    ensureActiveUser,
    ensureEmailAvailable,
    ensureRefreshableUser,
    generateTokens,
    hashData,
    verifyPassword,
    verifyRefreshToken,
} = require('./auth.helpers');

class AuthService {
    /**
     * Register a new user
     */
    async register(dto) {
        const existingUser = await authRepository.findUserUnique({
            where: { email: dto.email },
        });
        ensureEmailAvailable(existingUser);
        const hashedPassword = await hashData(dto.password);

        const user = await authRepository.createUser({
            data: {
                email: dto.email,
                password: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
            },
        });

        const tokens = generateTokens(buildAuthPayload(user));
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    /**
     * Login user
     */
    async login(dto) {
        const user = await authRepository.findUserUnique({
            where: { email: dto.email },
        });
        ensureActiveUser(user);
        await verifyPassword(user.password, dto.password);
        const tokens = generateTokens(buildAuthPayload(user));

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                refreshToken: await hashData(tokens.refreshToken),
                lastLoginAt: new Date(),
            },
        });

        return tokens;
    }

    /**
     * Logout user - invalidate refresh token
     */
    async logout(userId) {
        await authRepository.updateUser({
            where: { id: userId },
            data: { refreshToken: null },
        });
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshTokens(userId, refreshToken) {
        const user = await authRepository.findUserUnique({
            where: { id: userId },
        });
        ensureRefreshableUser(user);
        await verifyRefreshToken(user.refreshToken, refreshToken);
        const tokens = generateTokens(buildAuthPayload(user));
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    /**
     * Get current user profile
     */
    async getProfile(userId) {
        const user = await authRepository.findUserUnique({
            where: { id: userId },
            select: authProfileSelect,
        });

        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        return user;
    }

    async updateRefreshToken(userId, refreshToken) {
        const hashedRefreshToken = await hashData(refreshToken);
        await authRepository.updateUser({
            where: { id: userId },
            data: { refreshToken: hashedRefreshToken },
        });
    }
}

module.exports = new AuthService();
