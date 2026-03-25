const { Prisma } = require('@prisma/client');

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

const mapRuntimeError = (err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return new ConflictError('Duplicate field value entered');
        }

        if (err.code === 'P2025') {
            return new NotFoundError('Record not found');
        }

        if (err.code === 'P2003') {
            return new BadRequestError('Invalid reference');
        }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        return new BadRequestError('Invalid data provided');
    }

    if (err.name === 'JsonWebTokenError') {
        return new UnauthorizedError('Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return new UnauthorizedError('Token expired');
    }

    if (err.name === 'ValidationError') {
        const message = err.details?.map((detail) => detail.message).join(', ') || 'Validation error';
        return new BadRequestError(message);
    }

    return err;
};

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    mapRuntimeError,
};
