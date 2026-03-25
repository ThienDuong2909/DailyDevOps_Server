const { BadRequestError } = require('../errors/app-error');

const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const message = error.details.map((detail) => detail.message).join(', ');
            return next(new BadRequestError(message));
        }

        req[property] = value;
        next();
    };
};

module.exports = { validate };
