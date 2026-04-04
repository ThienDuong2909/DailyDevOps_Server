const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const config = require('../../config');
const authRepository = require('./auth.repository');
const {
    BadRequestError,
    UnauthorizedError,
} = require('../../middlewares/error.middleware');
const { authProfileSelect } = require('./auth.queries');
const { sendResetPasswordEmail, sendVerificationEmail } = require('./auth.mailer');
const {
    buildAuthPayload,
    createMfaChallengeToken,
    ensureActiveUser,
    ensureEmailAvailable,
    ensureMfaReady,
    ensureMfaSetupInProgress,
    ensureRefreshableUser,
    ensureVerifiedUser,
    generateTokens,
    getTokenExpiration,
    hashData,
    verifyMfaChallengeToken,
    verifyPassword,
    verifyRefreshToken,
} = require('./auth.helpers');

const resolveMfaAppName = () => {
    try {
        const hostname = new URL(config.appUrl).hostname.replace(/^www\./, '');
        return `DevOps Daily (${hostname})`;
    } catch {
        return 'DevOps Daily';
    }
};

const verifyTotpToken = (secret, token) =>
    speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 0,
    });

class AuthService {
    async register(dto) {
        const existingUser = await authRepository.findUserUnique({
            where: { email: dto.email },
        });
        ensureEmailAvailable(existingUser);
        const hashedPassword = await hashData(dto.password);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await authRepository.createUser({
            data: {
                email: dto.email,
                password: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
                role: 'AUTHOR',
                emailVerificationToken: verificationToken,
                emailVerificationExpiresAt,
            },
        });

        const mailResult = await sendVerificationEmail({
            email: user.email,
            firstName: user.firstName,
            verificationToken,
        });

        return {
            message: mailResult?.skipped
                ? 'Account created. Use the verification link below.'
                : 'Account created. Check your inbox to verify your email.',
            verificationToken: mailResult?.skipped ? verificationToken : null,
        };
    }

    async login(dto) {
        const user = await authRepository.findUserUnique({
            where: { email: dto.email },
        });
        ensureActiveUser(user);
        ensureVerifiedUser(user);
        await verifyPassword(user.password, dto.password);

        if (user.mfaEnabled && user.mfaSecret) {
            return {
                mfaRequired: true,
                challengeToken: createMfaChallengeToken(user),
                challengeExpiresAt: getTokenExpiration(config.jwt.mfaChallengeExpiresIn),
            };
        }

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

    async verifyLoginMfa(challengeToken, token) {
        const challenge = verifyMfaChallengeToken(challengeToken);
        const user = await authRepository.findUserUnique({
            where: { id: challenge.sub },
        });

        ensureActiveUser(user);
        ensureVerifiedUser(user);
        ensureMfaReady(user);

        if (!verifyTotpToken(user.mfaSecret, token)) {
            throw new UnauthorizedError('Authentication code is invalid or has expired');
        }

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

    async logout(userId) {
        await authRepository.updateUser({
            where: { id: userId },
            data: { refreshToken: null },
        });
    }

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

    async verifyEmail(token) {
        const user = await authRepository.findUserFirst({
            where: {
                emailVerificationToken: token,
                emailVerificationExpiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!user) {
            throw new UnauthorizedError('Verification link is invalid or has expired');
        }

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                emailVerifiedAt: new Date(),
                emailVerificationToken: null,
                emailVerificationExpiresAt: null,
            },
        });

        return {
            message: 'Email verified successfully',
        };
    }

    async resendVerification(email) {
        const user = await authRepository.findUserUnique({
            where: { email },
        });

        if (!user || !user.isActive || user.emailVerifiedAt) {
            return {
                message: 'If that account exists, a verification email has been sent.',
                verificationToken: null,
            };
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                emailVerificationToken: verificationToken,
                emailVerificationExpiresAt,
            },
        });

        const mailResult = await sendVerificationEmail({
            email: user.email,
            firstName: user.firstName,
            verificationToken,
        });

        return {
            message: mailResult?.skipped
                ? 'If that account exists, use the verification link below.'
                : 'If that account exists, a verification email has been sent.',
            verificationToken: mailResult?.skipped ? verificationToken : null,
        };
    }

    async forgotPassword(email) {
        const user = await authRepository.findUserUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            return {
                message: 'If that email exists, a reset link has been sent.',
                resetToken: null,
            };
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                resetPasswordToken: resetToken,
                resetPasswordExpiresAt,
            },
        });

        const mailResult = await sendResetPasswordEmail({
            email: user.email,
            firstName: user.firstName,
            resetToken,
        });

        return {
            message: mailResult?.skipped
                ? 'If that email exists, use the reset link below.'
                : 'If that email exists, a reset link has been sent.',
            resetToken: mailResult?.skipped ? resetToken : null,
        };
    }

    async resetPassword(token, password) {
        const user = await authRepository.findUserFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!user) {
            throw new UnauthorizedError('Reset link is invalid or has expired');
        }

        const hashedPassword = await hashData(password);

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                refreshToken: null,
                resetPasswordToken: null,
                resetPasswordExpiresAt: null,
            },
        });

        return {
            message: 'Password reset successfully',
        };
    }

    async changePassword(userId, currentPassword, newPassword) {
        const user = await authRepository.findUserUnique({
            where: { id: userId },
        });

        ensureActiveUser(user);
        await verifyPassword(user.password, currentPassword);

        const hashedPassword = await hashData(newPassword);

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                refreshToken: null,
            },
        });

        return {
            message: 'Password changed successfully. Please sign in again.',
        };
    }

    async setupMfa(userId) {
        const user = await authRepository.findUserUnique({
            where: { id: userId },
        });

        ensureActiveUser(user);
        ensureVerifiedUser(user);

        const issuer = resolveMfaAppName();
        const secret = speakeasy.generateSecret({
            length: 20,
            issuer,
            name: user.email,
        });

        if (!secret.base32 || !secret.otpauth_url) {
            throw new BadRequestError('Could not initialize MFA setup');
        }

        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                mfaTempSecret: secret.base32,
            },
        });

        return {
            secret: secret.base32,
            qrCodeDataUrl,
            otpauthUrl: secret.otpauth_url,
        };
    }

    async enableMfa(userId, password, token) {
        const user = await authRepository.findUserUnique({
            where: { id: userId },
        });

        ensureActiveUser(user);
        ensureVerifiedUser(user);
        ensureMfaSetupInProgress(user);
        await verifyPassword(user.password, password);

        if (!verifyTotpToken(user.mfaTempSecret, token)) {
            throw new UnauthorizedError('Authentication code is invalid or has expired');
        }

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                mfaEnabled: true,
                mfaSecret: user.mfaTempSecret,
                mfaTempSecret: null,
            },
        });

        return {
            message: 'Multi-factor authentication enabled successfully',
        };
    }

    async disableMfa(userId, password, token) {
        const user = await authRepository.findUserUnique({
            where: { id: userId },
        });

        ensureActiveUser(user);
        ensureVerifiedUser(user);
        ensureMfaReady(user);
        await verifyPassword(user.password, password);

        if (!verifyTotpToken(user.mfaSecret, token)) {
            throw new UnauthorizedError('Authentication code is invalid or has expired');
        }

        await authRepository.updateUser({
            where: { id: user.id },
            data: {
                mfaEnabled: false,
                mfaSecret: null,
                mfaTempSecret: null,
                refreshToken: null,
            },
        });

        return {
            message: 'Multi-factor authentication disabled successfully',
        };
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
