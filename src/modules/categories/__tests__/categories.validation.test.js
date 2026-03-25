const {
    categoryIdParamSchema,
    createCategorySchema,
    updateCategorySchema,
} = require('../categories.validation');

describe('Categories Validation', () => {
    describe('createCategorySchema', () => {
        it('accepts a valid category payload', () => {
            const { error } = createCategorySchema.validate({
                name: 'Cloud',
                slug: 'cloud',
                description: 'Cloud engineering content',
            });

            expect(error).toBeUndefined();
        });

        it('rejects missing name', () => {
            const { error } = createCategorySchema.validate({});
            expect(error).toBeDefined();
        });
    });

    describe('updateCategorySchema', () => {
        it('accepts a partial update payload', () => {
            const { error } = updateCategorySchema.validate({
                color: '#00bcd4',
            });

            expect(error).toBeUndefined();
        });
    });

    describe('categoryIdParamSchema', () => {
        it('accepts a valid category id', () => {
            const { error } = categoryIdParamSchema.validate({ id: 'category-1' });
            expect(error).toBeUndefined();
        });

        it('rejects missing category id', () => {
            const { error } = categoryIdParamSchema.validate({});
            expect(error).toBeDefined();
        });
    });
});
