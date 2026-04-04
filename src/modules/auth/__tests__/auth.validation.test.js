const {
    loginSchema,
    registerSchema,
    verifyMfaLoginSchema,
    enableMfaSchema,
} = require('../auth.validation');

describe('auth validation', () => {
    describe('registerSchema', () => {
        it('accepts a valid register payload', () => {
            const payload = {
                email: 'admin@devopsblog.com',
                password: 'Admin@123',
                firstName: 'Admin',
                lastName: 'User',
            };

            const { error, value } = registerSchema.validate(payload);

            expect(error).toBeUndefined();
            expect(value).toMatchObject(payload);
        });

        it('rejects invalid email and short password', () => {
            const { error } = registerSchema.validate(
                {
                    email: 'invalid-email',
                    password: '123',
                    firstName: 'Admin',
                    lastName: 'User',
                },
                { abortEarly: false }
            );

            expect(error).toBeDefined();
            expect(error.details.some((detail) => detail.message === 'Email must be valid')).toBe(true);
            expect(error.details.some((detail) => detail.message === 'Password must be at least 6 characters')).toBe(true);
        });
    });

    describe('loginSchema', () => {
        it('accepts a valid login payload', () => {
            const { error, value } = loginSchema.validate({
                email: 'admin@devopsblog.com',
                password: 'Admin@123',
            });

            expect(error).toBeUndefined();
            expect(value.email).toBe('admin@devopsblog.com');
        });

        it('requires email and password', () => {
            const { error } = loginSchema.validate({});

            expect(error).toBeDefined();
            expect(error.details.some((detail) => detail.message === 'Email is required')).toBe(true);
        });
    });

    describe('verifyMfaLoginSchema', () => {
        it('accepts a valid MFA verification payload', () => {
            const { error } = verifyMfaLoginSchema.validate({
                challengeToken: 'signed-challenge-token',
                token: '123456',
            });

            expect(error).toBeUndefined();
        });

        it('rejects invalid MFA token format', () => {
            const { error } = verifyMfaLoginSchema.validate({
                challengeToken: 'signed-challenge-token',
                token: '12ab',
            });

            expect(error).toBeDefined();
            expect(
                error.details.some(
                    (detail) =>
                        detail.message === 'Authentication code must be a 6-digit number'
                )
            ).toBe(true);
        });
    });

    describe('enableMfaSchema', () => {
        it('requires password and 6-digit token', () => {
            const { error } = enableMfaSchema.validate(
                {
                    password: '',
                    token: '123',
                },
                { abortEarly: false }
            );

            expect(error).toBeDefined();
            expect(
                error.details.some(
                    (detail) =>
                        detail.message === 'Authentication code must be a 6-digit number'
                )
            ).toBe(true);
        });
    });
});
