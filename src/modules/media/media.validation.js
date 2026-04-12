const Joi = require('joi');

const mediaUploadPurposeSchema = Joi.string()
    .valid('media', 'post-media', 'featured-image', 'avatar', 'seo', 'newsletter')
    .default('media');

const mediaObjectQuerySchema = Joi.object({
    key: Joi.string().required(),
});

const mediaListQuerySchema = Joi.object({
    folder: Joi.string()
        .valid('all', 'post-media', 'featured-images', 'avatars', 'seo', 'newsletter')
        .default('all'),
});

const mediaDeleteSchema = Joi.object({
    key: Joi.string().required(),
});

module.exports = {
    mediaListQuerySchema,
    mediaUploadPurposeSchema,
    mediaObjectQuerySchema,
    mediaDeleteSchema,
};
