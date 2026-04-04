const {
    queryUsersSchema,
    updateUserSchema,
    userIdParamSchema,
} = require('../users.validation');

describe('Users Validation', () => {
    describe('queryUsersSchema', () => {
        it('accepts valid query params', () => {
            const { error, value } = queryUsersSchema.validate({
                page: 2,
                limit: 20,
                role: 'ADMIN',
                search: 'john',
            });

            expect(error).toBeUndefined();
            expect(value.page).toBe(2);
        });

        it('rejects invalid role values', () => {
            const { error } = queryUsersSchema.validate({
                role: 'OWNER',
            });

            expect(error).toBeDefined();
        });
    });

    describe('updateUserSchema', () => {
        it('accepts a valid profile update payload', () => {
            const { error } = updateUserSchema.validate({
                firstName: 'John',
                lastName: 'Doe',
                bio: 'Platform engineer',
                isActive: true,
            });

            expect(error).toBeUndefined();
        });

        it('accepts internal media proxy paths for avatar', () => {
            const { error, value } = updateUserSchema.validate({
                avatar: '/api/v1/media/object?key=media%2F2026-04-03%2Fadmin-avatar.png',
            });

            expect(error).toBeUndefined();
            expect(value.avatar).toBe(
                '/api/v1/media/object?key=media%2F2026-04-03%2Fadmin-avatar.png'
            );
        });

        it('rejects invalid email', () => {
            const { error } = updateUserSchema.validate({
                email: 'bad-email',
            });

            expect(error).toBeDefined();
        });

        it('rejects too-short password', () => {
            const { error } = updateUserSchema.validate({
                password: '123',
            });

            expect(error).toBeDefined();
        });
    });

    describe('userIdParamSchema', () => {
        it('accepts a valid user id', () => {
            const { error } = userIdParamSchema.validate({ id: 'user-1' });
            expect(error).toBeUndefined();
        });

        it('rejects missing user id', () => {
            const { error } = userIdParamSchema.validate({});
            expect(error).toBeDefined();
        });
    });
});
