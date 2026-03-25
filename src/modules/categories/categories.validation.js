const Joi = require('joi');

const categoryIdParamSchema = Joi.object({
    id: Joi.string().required().messages({
        'any.required': 'Category id is required',
    }),
});

const createCategorySchema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required().messages({
        'any.required': 'Category name is required',
    }),
    slug: Joi.string().trim().max(120).optional().allow('', null),
    description: Joi.string().max(500).optional().allow('', null),
    color: Joi.string().max(50).optional().allow('', null),
    icon: Joi.string().max(100).optional().allow('', null),
    parentId: Joi.string().optional().allow('', null),
});

const updateCategorySchema = Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    slug: Joi.string().trim().max(120).optional().allow('', null),
    description: Joi.string().max(500).optional().allow('', null),
    color: Joi.string().max(50).optional().allow('', null),
    icon: Joi.string().max(100).optional().allow('', null),
    parentId: Joi.string().optional().allow('', null),
});

module.exports = {
    categoryIdParamSchema,
    createCategorySchema,
    updateCategorySchema,
};
