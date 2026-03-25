const Joi = require('joi');

const commentIdParamSchema = Joi.object({
    id: Joi.string().required().messages({
        'any.required': 'Comment id is required',
    }),
});

const postCommentsParamSchema = Joi.object({
    postId: Joi.string().required().messages({
        'any.required': 'Post id is required',
    }),
});

const queryCommentsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('all', 'PENDING', 'APPROVED', 'SPAM', 'TRASH').optional(),
    search: Joi.string().trim().allow('', null).optional(),
});

const createCommentSchema = Joi.object({
    content: Joi.string().trim().min(1).required().messages({
        'any.required': 'Content is required',
    }),
    postId: Joi.string().required().messages({
        'any.required': 'Post id is required',
    }),
    parentId: Joi.string().optional().allow(null, ''),
    authorName: Joi.string().max(100).optional().allow('', null),
    authorEmail: Joi.string().email().optional().allow('', null),
});

const updateCommentStatusSchema = Joi.object({
    status: Joi.string().valid('PENDING', 'APPROVED', 'SPAM', 'TRASH').required().messages({
        'any.required': 'Status is required',
    }),
});

module.exports = {
    commentIdParamSchema,
    postCommentsParamSchema,
    queryCommentsSchema,
    createCommentSchema,
    updateCommentStatusSchema,
};
