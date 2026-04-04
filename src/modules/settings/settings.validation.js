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
    content: Joi.object({
        headerNavigation: Joi.array().items(
            Joi.object({
                label: Joi.string().max(100).required(),
                href: Joi.string().max(255).required(),
            })
        ).required(),
        footerDescription: Joi.string().max(1000).allow('').required(),
        footerContentLinks: Joi.array().items(
            Joi.object({
                label: Joi.string().max(100).required(),
                href: Joi.string().max(255).required(),
            })
        ).required(),
        footerCompanyLinks: Joi.array().items(
            Joi.object({
                label: Joi.string().max(100).required(),
                href: Joi.string().max(255).required(),
            })
        ).required(),
        trendingTools: Joi.array().items(
            Joi.object({
                name: Joi.string().max(100).required(),
                shortName: Joi.string().max(10).required(),
                description: Joi.string().max(150).allow('').required(),
                href: Joi.string().max(255).required(),
            })
        ).required(),
    }).required(),
});

module.exports = {
    settingsSchema,
};
