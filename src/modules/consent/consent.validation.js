const Joi = require('joi');

const consentPreferencesSchema = Joi.object({
    essential: Joi.boolean().required(),
    analytics: Joi.boolean().required(),
    marketing: Joi.boolean().required(),
});

const trackConsentSchema = Joi.object({
    consentId: Joi.string().trim().max(200).required(),
    status: Joi.string().valid('accepted', 'essential-only', 'customized').required(),
    source: Joi.string().trim().max(100).default('cookie-banner'),
    preferences: consentPreferencesSchema.required(),
});

module.exports = {
    trackConsentSchema,
};
