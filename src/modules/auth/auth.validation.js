const Joi = require('joi');

const registerSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email must be valid',
        'any.required': 'Email is required',
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters',
        'any.required': 'Password is required',
    }),
    firstName: Joi.string().required().messages({
        'any.required': 'First name is required',
    }),
    lastName: Joi.string().required().messages({
        'any.required': 'Last name is required',
    }),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email must be valid',
        'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
    }),
});

const totpTokenSchema = Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
        'string.pattern.base': 'Authentication code must be a 6-digit number',
        'any.required': 'Authentication code is required',
    });

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email must be valid',
        'any.required': 'Email is required',
    }),
});

const resetPasswordSchema = Joi.object({
    token: Joi.string().required().messages({
        'any.required': 'Reset token is required',
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters',
        'any.required': 'Password is required',
    }),
});

const verifyEmailSchema = Joi.object({
    token: Joi.string().required().messages({
        'any.required': 'Verification token is required',
    }),
});

const resendVerificationSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email must be valid',
        'any.required': 'Email is required',
    }),
});

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required',
    }),
    newPassword: Joi.string().min(6).required().messages({
        'string.min': 'New password must be at least 6 characters',
        'any.required': 'New password is required',
    }),
});

const verifyMfaLoginSchema = Joi.object({
    challengeToken: Joi.string().required().messages({
        'any.required': 'MFA challenge token is required',
    }),
    token: totpTokenSchema,
});

const enableMfaSchema = Joi.object({
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
    }),
    token: totpTokenSchema,
});

const disableMfaSchema = Joi.object({
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
    }),
    token: totpTokenSchema,
});

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    resendVerificationSchema,
    changePasswordSchema,
    verifyMfaLoginSchema,
    enableMfaSchema,
    disableMfaSchema,
};
