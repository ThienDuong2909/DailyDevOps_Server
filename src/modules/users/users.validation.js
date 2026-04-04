const Joi = require('joi');

const avatarSchema = Joi.string()
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

        return helpers.message('"avatar" must be a valid uri');
    })
    .optional()
    .allow('', null);

const userIdParamSchema = Joi.object({
    id: Joi.string().required().messages({
        'any.required': 'User id is required',
    }),
});

const queryUsersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR', 'VIEWER').optional(),
    search: Joi.string().optional().allow(''),
});

const updateUserSchema = Joi.object({
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    firstName: Joi.string().max(100).optional(),
    lastName: Joi.string().max(100).optional(),
    avatar: avatarSchema,
    bio: Joi.string().max(1000).optional().allow('', null),
    role: Joi.string().valid('ADMIN', 'MODERATOR', 'EDITOR', 'AUTHOR', 'VIEWER').optional(),
    isActive: Joi.boolean().optional(),
});

const deleteAccountRequestSchema = Joi.object({
    reason: Joi.string().max(1000).optional().allow('', null),
});

module.exports = {
    userIdParamSchema,
    queryUsersSchema,
    updateUserSchema,
    deleteAccountRequestSchema,
};
