const Joi = require('joi');

const complianceOverviewQuerySchema = Joi.object({
    days: Joi.number().integer().min(1).max(180).default(30),
});

module.exports = {
    complianceOverviewQuerySchema,
};
