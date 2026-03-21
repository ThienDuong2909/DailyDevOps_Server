require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

// ============================================
// SECURITY: Fail fast if JWT secrets are not set in production
// ============================================
if (nodeEnv === 'production') {
    const requiredEnvVars = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
    const missing = requiredEnvVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
}

// Parse CORS origins (support comma-separated list)
const parseCorsOrigin = (origin) => {
    if (!origin) return 'http://localhost:3000';
    const origins = origin.split(',').map((o) => o.trim());
    return origins.length === 1 ? origins[0] : origins;
};

const config = {
    // Server
    nodeEnv,
    port: parseInt(process.env.PORT, 10) || 3001,
    apiPrefix: (process.env.API_PREFIX === 'api' ? 'api/v1' : process.env.API_PREFIX) || 'api/v1',

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // CORS — supports comma-separated origins
    corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    },

    // Swagger
    swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
};

module.exports = config;
