const Joi = require('joi');

const userIdParamSchema = Joi.object({
    id: Joi.string().required().messages({
        'any.required': 'User id is required',
    }),
});

const queryUsersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('ADMIN', 'MODERATOR', 'EDITOR', 'VIEWER').optional(),
    search: Joi.string().optional().allow(''),
});

const updateUserSchema = Joi.object({
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    firstName: Joi.string().max(100).optional(),
    lastName: Joi.string().max(100).optional(),
    avatar: Joi.string().uri().optional().allow('', null),
    bio: Joi.string().max(1000).optional().allow('', null),
    role: Joi.string().valid('ADMIN', 'MODERATOR', 'EDITOR', 'VIEWER').optional(),
    isActive: Joi.boolean().optional(),
});

module.exports = {
    userIdParamSchema,
    queryUsersSchema,
    updateUserSchema,
};
