const jwt = require('jsonwebtoken');

const config = require('../../config');
const { UnauthorizedError, ForbiddenError } = require('../errors/app-error');
const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

const userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
};

const resolveBearerToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('No token provided');
    }

    return authHeader.substring(7);
};

const loadActiveUser = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
    });

    if (!user || !user.isActive) {
        throw new UnauthorizedError('User not found or inactive');
    }

    return user;
};

const authenticate = async (req, res, next) => {
    try {
        const token = resolveBearerToken(req.headers.authorization);
        const decoded = jwt.verify(token, config.jwt.accessSecret);
        req.user = await loadActiveUser(decoded.sub);
        next();
    } catch (error) {
        next(error);
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, config.jwt.accessSecret);
            req.user = await loadActiveUser(decoded.sub);
        }

        next();
    } catch (error) {
        next();
    }
};

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError('Insufficient permissions'));
        }

        next();
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
};
