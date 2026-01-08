require('dotenv').config();

const config = {
    // Server
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,
    apiPrefix: process.env.API_PREFIX || 'api',

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    },

    // Swagger
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
};

module.exports = config;
