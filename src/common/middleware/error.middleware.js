const { NotFoundError, mapRuntimeError } = require('../errors/app-error');

const errorHandler = (err, req, res, next) => {
    let error = mapRuntimeError(err);
    error.message = error.message || err.message;
    error.statusCode = error.statusCode || 500;

    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    res.status(error.statusCode).json({
        success: false,
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

const notFoundHandler = (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
