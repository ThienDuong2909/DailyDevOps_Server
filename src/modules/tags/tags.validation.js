const Joi = require('joi');

const tagIdParamSchema = Joi.object({
    id: Joi.string().required().messages({
        'any.required': 'Tag id is required',
    }),
});

const createTagSchema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required().messages({
        'any.required': 'Tag name is required',
    }),
    slug: Joi.string().trim().max(120).optional().allow('', null),
});

const updateTagSchema = Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    slug: Joi.string().trim().max(120).optional().allow('', null),
});

module.exports = {
    tagIdParamSchema,
    createTagSchema,
    updateTagSchema,
};
