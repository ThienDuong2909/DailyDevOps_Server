const { Prisma } = require('@prisma/client');

// Custom Error Classes
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad Request') {
        super(message, 400);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Not Found') {
        super(message, 404);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409);
    }
}

// Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Log error
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    // Prisma Errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            error = new ConflictError('Duplicate field value entered');
        } else if (err.code === 'P2025') {
            error = new NotFoundError('Record not found');
        } else if (err.code === 'P2003') {
            error = new BadRequestError('Invalid reference');
        }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        error = new BadRequestError('Invalid data provided');
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        error = new UnauthorizedError('Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        error = new UnauthorizedError('Token expired');
    }

    // Validation Errors (Joi)
    if (err.name === 'ValidationError') {
        const message = err.details?.map(detail => detail.message).join(', ') || 'Validation error';
        error = new BadRequestError(message);
    }

    res.status(error.statusCode).json({
        success: false,
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

// 404 Not Found Handler
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
};

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    errorHandler,
    notFoundHandler,
};
