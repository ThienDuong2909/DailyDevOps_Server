const Joi = require('joi');

const opsExportQuerySchema = Joi.object({
    includeDrafts: Joi.boolean().truthy('true').falsy('false').default(true),
    includeActivityLogs: Joi.boolean().truthy('true').falsy('false').default(false),
});

module.exports = {
    opsExportQuerySchema,
};
