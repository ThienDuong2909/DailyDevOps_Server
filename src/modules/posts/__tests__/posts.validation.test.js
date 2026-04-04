const { createPostSchema, queryPostSchema, updatePostSchema } = require('../posts.validation');

describe('posts validation', () => {
    it('accepts a valid create payload and defaults status', () => {
        const { error, value } = createPostSchema.validate({
            title: 'Kubernetes Rollout Strategy',
            subtitle: 'Tactical rollout notes for platform teams',
            contentHtml: '<h2>Overview</h2><p>Detailed article body</p>',
            tagIds: ['tag-1', 'tag-2'],
        });

        expect(error).toBeUndefined();
        expect(value.status).toBe('DRAFT');
        expect(value.title).toBe('Kubernetes Rollout Strategy');
        expect(value.subtitle).toBe('Tactical rollout notes for platform teams');
    });

    it('rejects create payload without required fields', () => {
        const { error } = createPostSchema.validate(
            {
                title: '',
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.some((detail) => detail.path.includes('title'))).toBe(true);
    });

    it('requires either content or contentHtml', () => {
        const { error } = createPostSchema.validate(
            {
                title: 'Release notes',
                subtitle: 'Short overview',
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.some((detail) => detail.message === 'Content is required')).toBe(true);
    });

    it('accepts a partial update payload', () => {
        const { error, value } = updatePostSchema.validate({
            status: 'PUBLISHED',
            featuredImage: 'https://images.example.com/post-cover.webp',
            contentJson: {
                type: 'doc',
                content: [],
            },
        });

        expect(error).toBeUndefined();
        expect(value.status).toBe('PUBLISHED');
    });

    it('accepts internal media proxy paths for featuredImage', () => {
        const { error, value } = createPostSchema.validate({
            title: 'Internal media image test',
            contentHtml: '<p>body</p>',
            featuredImage:
                '/api/v1/media/object?key=media%2F2026-04-02%2Fsample-image.png',
        });

        expect(error).toBeUndefined();
        expect(value.featuredImage).toBe(
            '/api/v1/media/object?key=media%2F2026-04-02%2Fsample-image.png'
        );
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
