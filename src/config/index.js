require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

const parseNumber = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value, fallback) => {
    if (value === undefined) return fallback;
    return value === 'true';
};

const parseTrustProxy = (value, fallback) => {
    if (value === undefined || value === '') {
        return fallback;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
        return parsed;
    }

    return value;
};

const normalizeOrigin = (value) => {
    if (!value) return '';
    return value.trim().replace(/\/+$/, '');
};

const parseCorsOrigin = (origin, appUrl) => {
    const origins = (origin || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean);

    const normalizedAppUrl = normalizeOrigin(appUrl);
    if (normalizedAppUrl && !origins.includes(normalizedAppUrl)) {
        origins.push(normalizedAppUrl);
    }

    return origins.length > 0 ? origins : ['http://localhost:3000'];
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
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY, nodeEnv === 'production' ? 1 : false),

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
        thumbnailGenerationIntervalMs: parseNumber(
            process.env.THUMBNAIL_GENERATION_INTERVAL_MS,
            5000
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

    log: {
        format: process.env.LOG_FORMAT || 'pretty',
        skipHealthChecks: process.env.LOG_SKIP_HEALTH !== 'false',
        onlyApiRequests: process.env.LOG_ONLY_API !== 'false',
    },

    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
    },

    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview',
        imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
    },
};

config.corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN, config.appUrl);

module.exports = config;
