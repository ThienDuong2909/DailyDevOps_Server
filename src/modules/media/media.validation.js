const Joi = require('joi');

const mediaUploadPurposeSchema = Joi.string()
    .valid('media', 'post-media', 'featured-image', 'avatar', 'seo', 'newsletter')
    .default('media');

const mediaObjectQuerySchema = Joi.object({
    key: Joi.string().required(),
});

const mediaDeleteSchema = Joi.object({
    key: Joi.string().required(),
});

module.exports = {
    mediaUploadPurposeSchema,
    mediaObjectQuerySchema,
    mediaDeleteSchema,
};
