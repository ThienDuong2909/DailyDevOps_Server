try {
    require('dotenv').config();
} catch {
    // Ignore in Cloudflare Workers runtime
}

const { randomBytes } = require('node:crypto');

const getEnv = (key, fallback = undefined) => {
    if (globalThis.__CF_ENV && globalThis.__CF_ENV[key] !== undefined && typeof globalThis.__CF_ENV[key] === 'string') {
        return globalThis.__CF_ENV[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
        return process.env[key];
    }
    return fallback;
};

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

const localAccessSigningValue = 'devops_blog_default_local_access_secret_key_fallback_32b';
const localRefreshSigningValue = 'devops_blog_default_local_refresh_secret_key_fallback_32b';
const localMfaSigningValue = 'devops_blog_default_local_mfa_secret_key_fallback_32b';

function buildConfig() {
    const nodeEnv = getEnv('NODE_ENV', 'development');
    const appUrl = getEnv('APP_URL', 'http://localhost:3000');

    return {
        nodeEnv,
        port: parseNumber(getEnv('PORT'), 3001),
        apiPrefix: resolveApiPrefix(getEnv('API_PREFIX')),
        trustProxy: parseTrustProxy(getEnv('TRUST_PROXY'), nodeEnv === 'production' ? 1 : false),
        databaseUrl: getEnv('DATABASE_URL'),
        jwt: {
            accessSecret: getEnv('JWT_ACCESS_SECRET') || localAccessSigningValue,
            refreshSecret: getEnv('JWT_REFRESH_SECRET') || localRefreshSigningValue,
            mfaSecret: getEnv('JWT_MFA_SECRET') || getEnv('JWT_ACCESS_SECRET') || localMfaSigningValue,
            accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
            refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
            mfaChallengeExpiresIn: getEnv('JWT_MFA_CHALLENGE_EXPIRES_IN', '10m'),
        },
        corsOrigin: parseCorsOrigin(getEnv('CORS_ORIGIN'), appUrl),
        rateLimit: {
            windowMs: parseNumber(getEnv('RATE_LIMIT_WINDOW_MS'), 60000),
            maxRequests: parseNumber(getEnv('RATE_LIMIT_MAX_REQUESTS'), 100),
        },
        swaggerEnabled: getEnv('SWAGGER_ENABLED') !== 'false',
        jobs: {
            scheduledPublishIntervalMs: parseNumber(getEnv('SCHEDULED_PUBLISH_INTERVAL_MS'), 30000),
            thumbnailGenerationIntervalMs: parseNumber(getEnv('THUMBNAIL_GENERATION_INTERVAL_MS'), 5000),
        },
        appUrl,
        email: {
            smtpHost: getEnv('SMTP_HOST', ''),
            smtpPort: parseNumber(getEnv('SMTP_PORT'), 465),
            secure: getEnv('SMTP_SECURE') !== 'false',
            smtpUser: getEnv('SMTP_USER', ''),
            smtpPass: getEnv('SMTP_PASS', ''),
            contactInbox: getEnv('CONTACT_INBOX') || getEnv('SMTP_USER', ''),
            from: getEnv('EMAIL_FROM') || getEnv('SMTP_USER') || 'no-reply@localhost',
        },
        storage: {
            endpoint: getEnv('S3_ENDPOINT', ''),
            region: getEnv('S3_REGION', 'auto'),
            bucket: getEnv('S3_BUCKET', ''),
            accessKeyId: getEnv('S3_ACCESS_KEY_ID', ''),
            secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY', ''),
        },
        sentry: {
            dsn: getEnv('SENTRY_DSN', ''),
            tracesSampleRate: Number.parseFloat(getEnv('SENTRY_TRACES_SAMPLE_RATE', '0')),
        },
        log: {
            format: getEnv('LOG_FORMAT', 'pretty'),
            skipHealthChecks: getEnv('LOG_SKIP_HEALTH') !== 'false',
            onlyApiRequests: getEnv('LOG_ONLY_API') !== 'false',
        },
        openrouter: {
            apiKey: getEnv('OPENROUTER_API_KEY', ''),
        },
        gemini: {
            apiKey: getEnv('GEMINI_API_KEY', ''),
            textModel: getEnv('GEMINI_TEXT_MODEL', 'gemini-2.0-flash'),
            imageModel: getEnv('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
        },
    };
}

let cachedConfig = buildConfig();

function refreshConfigFromEnv(env = {}) {
    globalThis.__CF_ENV = env;
    if (typeof process !== 'undefined' && process.env) {
        for (const [k, v] of Object.entries(env)) {
            if (typeof v === 'string') {
                process.env[k] = v;
            }
        }
    }
    cachedConfig = buildConfig();
    return cachedConfig;
}

const configProxy = new Proxy(
    {},
    {
        get(_target, prop) {
            if (prop === 'refreshConfigFromEnv') return refreshConfigFromEnv;
            return cachedConfig[prop];
        },
    }
);

module.exports = configProxy;
