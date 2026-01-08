const { BadRequestError } = require('./error.middleware');

// Validation Middleware Factory
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const message = error.details.map(detail => detail.message).join(', ');
            return next(new BadRequestError(message));
        }

        // Replace the validated property with sanitized value
        req[property] = value;
        next();
    };
};

module.exports = { validate };
