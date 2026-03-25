const { loginSchema, registerSchema } = require('../auth.validation');

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
});
