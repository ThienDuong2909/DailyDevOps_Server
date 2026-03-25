const {
    createTagSchema,
    tagIdParamSchema,
    updateTagSchema,
} = require('../tags.validation');

describe('Tags Validation', () => {
    describe('createTagSchema', () => {
        it('accepts a valid create payload', () => {
            const { error } = createTagSchema.validate({
                name: 'kubernetes',
                slug: 'kubernetes',
            });

            expect(error).toBeUndefined();
        });

        it('rejects missing name', () => {
            const { error } = createTagSchema.validate({});
            expect(error).toBeDefined();
        });
    });

    describe('updateTagSchema', () => {
        it('accepts a partial update payload', () => {
            const { error } = updateTagSchema.validate({
                name: 'docker',
            });

            expect(error).toBeUndefined();
        });
    });

    describe('tagIdParamSchema', () => {
        it('accepts a valid tag id', () => {
            const { error } = tagIdParamSchema.validate({ id: 'tag-1' });
            expect(error).toBeUndefined();
        });

        it('rejects missing tag id', () => {
            const { error } = tagIdParamSchema.validate({});
            expect(error).toBeDefined();
        });
    });
});
