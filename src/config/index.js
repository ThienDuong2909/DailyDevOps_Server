require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

const parseNumber = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseCorsOrigin = (origin) => {
    if (!origin) return ['http://localhost:3000'];
    return origin
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
};

const resolveApiPrefix = (value) => {
    if (value === 'api') return 'api/v1';
    return value || 'api/v1';
};

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

const config = {
    // Server
    nodeEnv,
    port: parseNumber(process.env.PORT, 3001),
    apiPrefix: resolveApiPrefix(process.env.API_PREFIX),

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
        mfaSecret:
            process.env.JWT_MFA_SECRET ||
            process.env.JWT_ACCESS_SECRET ||
            'dev-mfa-secret-change-in-production',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        mfaChallengeExpiresIn: process.env.JWT_MFA_CHALLENGE_EXPIRES_IN || '10m',
    },

    // CORS — supports comma-separated origins
    corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),

    // Rate Limiting
    rateLimit: {
        windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000),
        maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    },

    // Swagger
    swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',

    // Background jobs
    jobs: {
        scheduledPublishIntervalMs: parseNumber(
            process.env.SCHEDULED_PUBLISH_INTERVAL_MS,
            30000
        ),
    },

    // Public app URLs
    appUrl: process.env.APP_URL || 'http://localhost:3000',

    // Email
    email: {
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseNumber(process.env.SMTP_PORT, 465),
        secure: process.env.SMTP_SECURE !== 'false',
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
        contactInbox: process.env.CONTACT_INBOX || process.env.SMTP_USER || '',
        from:
            process.env.EMAIL_FROM ||
            process.env.SMTP_USER ||
            'no-reply@localhost',
    },

    storage: {
        endpoint: process.env.S3_ENDPOINT || '',
        region: process.env.S3_REGION || 'auto',
        bucket: process.env.S3_BUCKET || '',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },

    sentry: {
        dsn: process.env.SENTRY_DSN || '',
        tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0'),
    },
};

module.exports = config;
