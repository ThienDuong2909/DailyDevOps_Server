const Joi = require('joi');

const featuredImageSchema = Joi.string()
    .custom((value, helpers) => {
        if (value === '' || value === null || value === undefined) {
            return value;
        }

        if (
            /^https?:\/\//i.test(value) ||
            value.startsWith('/api/v1/media/object?key=')
        ) {
            return value;
        }

        return helpers.message('"featuredImage" must be a valid uri');
    })
    .optional()
    .allow('', null);

const createPostSchema = Joi.object({
    title: Joi.string().required().messages({
        'any.required': 'Title is required',
    }),
    slug: Joi.string().optional(),
    subtitle: Joi.string().optional().allow('', null),
    excerpt: Joi.string().optional().allow('', null),
    content: Joi.string().optional().allow('', null),
    contentHtml: Joi.string().optional().allow('', null),
    contentJson: Joi.alternatives().try(Joi.object(), Joi.array()).optional().allow(null),
    featuredImage: featuredImageSchema,
    status: Joi.string().valid('DRAFT', 'REVIEW', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').default('DRAFT'),
    categoryId: Joi.string().optional().allow('', null),
    tagIds: Joi.array().items(Joi.string()).optional(),
    scheduledAt: Joi.date().optional().allow(null),
    rejectionReason: Joi.string().max(2000).optional().allow('', null),
}).custom((value, helpers) => {
    if (!value.content && !value.contentHtml) {
        return helpers.error('any.custom', { message: 'Content is required' });
    }

    return value;
}).messages({
    'any.custom': '{{#message}}',
});

const updatePostSchema = Joi.object({
    title: Joi.string().optional(),
    slug: Joi.string().optional(),
    subtitle: Joi.string().optional().allow('', null),
    excerpt: Joi.string().optional().allow('', null),
    content: Joi.string().optional(),
    contentHtml: Joi.string().optional().allow('', null),
    contentJson: Joi.alternatives().try(Joi.object(), Joi.array()).optional().allow(null),
    featuredImage: featuredImageSchema,
    status: Joi.string().valid('DRAFT', 'REVIEW', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').optional(),
    categoryId: Joi.string().optional().allow('', null),
    tagIds: Joi.array().items(Joi.string()).optional(),
    scheduledAt: Joi.date().optional().allow(null),
    rejectionReason: Joi.string().max(2000).optional().allow('', null),
    createVersion: Joi.boolean().optional(),
});

const queryPostSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().optional(),
    status: Joi.string().valid('DRAFT', 'REVIEW', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').optional(),
    categoryId: Joi.string().optional(),
    authorId: Joi.string().optional(),
    tagSlug: Joi.string().optional(),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'publishedAt', 'viewCount', 'title').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const autocompletePostSchema = Joi.object({
    q: Joi.string().trim().min(1).max(100).required(),
    limit: Joi.number().integer().min(1).max(10).default(5),
});

const rejectPostSchema = Joi.object({
    rejectionReason: Joi.string().trim().min(5).max(2000).required(),
});

const postIdParamSchema = Joi.object({
    id: Joi.string().required(),
});

const restoreVersionSchema = Joi.object({
    reason: Joi.string().trim().max(2000).optional().allow('', null),
});

const versionParamsSchema = Joi.object({
    id: Joi.string().required(),
    versionId: Joi.string().required(),
});

const generateFeaturedImageSchema = Joi.object({
    title: Joi.string().trim().max(300).optional().allow('', null),
    subtitle: Joi.string().trim().max(500).optional().allow('', null),
    content: Joi.string().optional().allow('', null),
    contentHtml: Joi.string().optional().allow('', null),
    categoryName: Joi.string().trim().max(120).optional().allow('', null),
    tagNames: Joi.array().items(Joi.string().trim().max(120)).optional(),
}).custom((value, helpers) => {
    if (!value.title && !value.content && !value.contentHtml) {
        return helpers.error('any.custom', {
            message: 'Title or content is required to generate a thumbnail',
        });
    }

    return value;
}).messages({
    'any.custom': '{{#message}}',
});

const enqueueFeaturedImageJobSchema = generateFeaturedImageSchema;

module.exports = {
    createPostSchema,
    updatePostSchema,
    queryPostSchema,
    autocompletePostSchema,
    rejectPostSchema,
    postIdParamSchema,
    restoreVersionSchema,
    versionParamsSchema,
    generateFeaturedImageSchema,
    enqueueFeaturedImageJobSchema,
};
