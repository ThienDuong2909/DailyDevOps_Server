const Joi = require('joi');

const TRACKED_EVENT_TYPES = [
    'PAGE_VIEW',
    'SEARCH',
    'NEWSLETTER_SUBSCRIBE',
    'COMMENT_SUBMIT',
];

const eventPayloadSchema = Joi.object({
    path: Joi.string().max(500),
    title: Joi.string().max(200),
    searchTerm: Joi.string().max(120),
    resultsCount: Joi.number().integer().min(0),
    placement: Joi.string().max(80),
    postSlug: Joi.string().max(160),
}).unknown(false);

const trackAnalyticsEventSchema = Joi.object({
    eventType: Joi.string()
        .valid(...TRACKED_EVENT_TYPES)
        .required(),
    payload: eventPayloadSchema.default({}),
});

const analyticsOverviewQuerySchema = Joi.object({
    days: Joi.number().integer().min(1).max(90).default(30),
});

module.exports = {
    TRACKED_EVENT_TYPES,
    trackAnalyticsEventSchema,
    analyticsOverviewQuerySchema,
};
