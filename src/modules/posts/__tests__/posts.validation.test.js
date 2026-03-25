const { createPostSchema, queryPostSchema, updatePostSchema } = require('../posts.validation');

describe('posts validation', () => {
    it('accepts a valid create payload and defaults status', () => {
        const { error, value } = createPostSchema.validate({
            title: 'Kubernetes Rollout Strategy',
            content: 'Detailed article body',
            tagIds: ['tag-1', 'tag-2'],
        });

        expect(error).toBeUndefined();
        expect(value.status).toBe('DRAFT');
        expect(value.title).toBe('Kubernetes Rollout Strategy');
    });

    it('rejects create payload without required fields', () => {
        const { error } = createPostSchema.validate(
            {
                excerpt: 'Only excerpt',
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.some((detail) => detail.message === 'Title is required')).toBe(true);
        expect(error.details.some((detail) => detail.message === 'Content is required')).toBe(true);
    });

    it('accepts a partial update payload', () => {
        const { error, value } = updatePostSchema.validate({
            status: 'PUBLISHED',
            featuredImage: 'https://images.example.com/post-cover.webp',
        });

        expect(error).toBeUndefined();
        expect(value.status).toBe('PUBLISHED');
    });

    it('applies query defaults and rejects invalid sort values', () => {
        const validResult = queryPostSchema.validate({});
        expect(validResult.error).toBeUndefined();
        expect(validResult.value.page).toBe(1);
        expect(validResult.value.limit).toBe(10);
        expect(validResult.value.sortBy).toBe('createdAt');
        expect(validResult.value.sortOrder).toBe('desc');

        const invalidResult = queryPostSchema.validate({
            sortBy: 'unknown-field',
            sortOrder: 'sideways',
        });

        expect(invalidResult.error).toBeDefined();
    });
});
