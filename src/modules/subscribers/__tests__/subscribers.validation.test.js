const { subscribeSchema, unsubscribeSchema } = require('../subscribers.validation');

describe('Subscribers Validation', () => {
    // =============================================
    // subscribeSchema
    // =============================================
    describe('subscribeSchema', () => {
        it('should validate a valid email', () => {
            const { error, value } = subscribeSchema.validate({ email: 'test@example.com' });
            expect(error).toBeUndefined();
            expect(value.email).toBe('test@example.com');
        });

        it('should validate email with name', () => {
            const { error, value } = subscribeSchema.validate({
                email: 'test@example.com',
                name: 'John Doe',
            });
            expect(error).toBeUndefined();
            expect(value.email).toBe('test@example.com');
            expect(value.name).toBe('John Doe');
        });

        it('should reject missing email', () => {
            const { error } = subscribeSchema.validate({});
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('Email is required');
        });

        it('should reject invalid email', () => {
            const { error } = subscribeSchema.validate({ email: 'not-an-email' });
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('Email must be a valid email address');
        });

        it('should reject name longer than 100 characters', () => {
            const { error } = subscribeSchema.validate({
                email: 'test@example.com',
                name: 'a'.repeat(101),
            });
            expect(error).toBeDefined();
        });

        it('should allow empty name (optional)', () => {
            const { error } = subscribeSchema.validate({ email: 'test@example.com' });
            expect(error).toBeUndefined();
        });
    });

    // =============================================
    // unsubscribeSchema
    // =============================================
    describe('unsubscribeSchema', () => {
        it('should validate a valid token', () => {
            const { error, value } = unsubscribeSchema.validate({ token: 'abc123def456' });
            expect(error).toBeUndefined();
            expect(value.token).toBe('abc123def456');
        });

        it('should reject missing token', () => {
            const { error } = unsubscribeSchema.validate({});
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('Unsubscribe token is required');
        });

        it('should reject empty token', () => {
            const { error } = unsubscribeSchema.validate({ token: '' });
            expect(error).toBeDefined();
        });
    });
});
