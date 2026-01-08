const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('./error.middleware');
const { getPrismaClient } = require('../utils/prisma');

const prisma = getPrismaClient();

// Verify JWT Access Token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.accessSecret);

        // Fetch user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedError('User not found or inactive');
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

// Optional Authentication (doesn't throw error if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, config.jwt.accessSecret);

            const user = await prisma.user.findUnique({
                where: { id: decoded.sub },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                },
            });

            if (user && user.isActive) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        // Ignore auth errors for optional auth
        next();
    }
};

// Role-based Authorization
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
