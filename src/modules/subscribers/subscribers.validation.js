const Joi = require('joi');

const subscribeSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required',
    }),
    name: Joi.string().max(100).optional(),
});

const unsubscribeSchema = Joi.object({
    token: Joi.string().required().messages({
        'any.required': 'Unsubscribe token is required',
    }),
});

module.exports = {
    subscribeSchema,
    unsubscribeSchema,
};
