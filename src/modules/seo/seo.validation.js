const Joi = require('joi');

const seoPageSchema = Joi.object({
    metaTitle: Joi.string().allow('').required(),
    metaDescription: Joi.string().allow('').required(),
    canonicalUrl: Joi.string().uri().allow('').required(),
    focusKeywords: Joi.array().items(Joi.string().allow('')).required(),
    ogImage: Joi.string().uri().allow('').required(),
    noIndex: Joi.boolean().required(),
    noFollow: Joi.boolean().required(),
});

const updateSeoSchema = Joi.object({
    globalSettings: Joi.object({
        searchIndexing: Joi.boolean().required(),
        homepageTitleSuffix: Joi.string().allow('').required(),
        robotsTxt: Joi.string().allow('').required(),
        analyticsId: Joi.string().allow('').required(),
    }).required(),
    homepage: seoPageSchema.required(),
});

module.exports = {
    updateSeoSchema,
};
