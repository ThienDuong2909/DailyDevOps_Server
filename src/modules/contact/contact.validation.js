const Joi = require('joi');

const createContactMessageSchema = Joi.object({
    name: Joi.string().min(2).max(120).required().messages({
        'string.min': 'Name must be at least 2 characters',
        'any.required': 'Name is required',
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Email must be valid',
        'any.required': 'Email is required',
    }),
    subject: Joi.string().min(4).max(160).required().messages({
        'string.min': 'Subject must be at least 4 characters',
        'any.required': 'Subject is required',
    }),
    message: Joi.string().min(20).max(5000).required().messages({
        'string.min': 'Message must be at least 20 characters',
        'any.required': 'Message is required',
    }),
    website: Joi.string().allow('').optional(),
});

module.exports = {
    createContactMessageSchema,
};
