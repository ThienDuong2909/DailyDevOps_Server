const Joi = require('joi');

const settingsSchema = Joi.object({
    general: Joi.object({
        siteName: Joi.string().max(255).required(),
        siteUrl: Joi.string().uri().required(),
        siteDescription: Joi.string().max(1000).allow('').required(),
        language: Joi.string().max(20).required(),
        timezone: Joi.string().max(100).required(),
        postsPerPage: Joi.number().integer().min(1).max(100).required(),
        allowComments: Joi.boolean().required(),
        moderateComments: Joi.boolean().required(),
    }).required(),
    appearance: Joi.object({
        darkModeDefault: Joi.boolean().required(),
        primaryColor: Joi.string().max(20).required(),
    }).required(),
    email: Joi.object({
        smtpHost: Joi.string().allow('').required(),
        smtpPort: Joi.string().allow('').required(),
        smtpUser: Joi.string().allow('').required(),
        notifyNewComment: Joi.boolean().required(),
        notifyNewUser: Joi.boolean().required(),
    }).required(),
    maintenance: Joi.object({
        maintenanceMode: Joi.boolean().required(),
    }).required(),
});

module.exports = {
    settingsSchema,
};
