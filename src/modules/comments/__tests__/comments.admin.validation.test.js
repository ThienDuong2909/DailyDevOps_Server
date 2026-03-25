const {
    queryCommentsSchema,
} = require('../comments.validation');

describe('comments admin query validation', () => {
    it('accepts supported filter values', () => {
        const { error, value } = queryCommentsSchema.validate({
            page: 2,
            limit: 20,
            status: 'PENDING',
            search: 'kubernetes',
        });

        expect(error).toBeUndefined();
        expect(value.page).toBe(2);
        expect(value.limit).toBe(20);
        expect(value.status).toBe('PENDING');
    });

    it('rejects unsupported comment status', () => {
        const { error } = queryCommentsSchema.validate({
            status: 'DELETED',
        });

        expect(error).toBeDefined();
    });
});
