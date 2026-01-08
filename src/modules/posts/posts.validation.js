const Joi = require('joi');

const createPostSchema = Joi.object({
    title: Joi.string().required().messages({
        'any.required': 'Title is required',
    }),
    slug: Joi.string().optional(),
    excerpt: Joi.string().optional().allow('', null),
    content: Joi.string().required().messages({
        'any.required': 'Content is required',
    }),
    featuredImage: Joi.string().uri().optional().allow('', null),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').default('DRAFT'),
    categoryId: Joi.string().optional().allow('', null),
    tagIds: Joi.array().items(Joi.string()).optional(),
    scheduledAt: Joi.date().optional().allow(null),
});

const updatePostSchema = Joi.object({
    title: Joi.string().optional(),
    slug: Joi.string().optional(),
    excerpt: Joi.string().optional().allow('', null),
    content: Joi.string().optional(),
    featuredImage: Joi.string().uri().optional().allow('', null),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').optional(),
    categoryId: Joi.string().optional().allow('', null),
    tagIds: Joi.array().items(Joi.string()).optional(),
    scheduledAt: Joi.date().optional().allow(null),
});

const queryPostSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().optional(),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED').optional(),
    categoryId: Joi.string().optional(),
    authorId: Joi.string().optional(),
    tagSlug: Joi.string().optional(),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'publishedAt', 'viewCount', 'title').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
    createPostSchema,
    updatePostSchema,
    queryPostSchema,
};
