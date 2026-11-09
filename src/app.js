const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { requestLogger } = require('./common/middleware/logger.middleware');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { errorHandler, notFoundHandler } = require('./common/middleware/error.middleware');
const { register, metricsMiddleware } = require('./common/observability/metrics');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const postsRoutes = require('./modules/posts/posts.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const tagsRoutes = require('./modules/tags/tags.routes');
const commentsRoutes = require('./modules/comments/comments.routes');
const usersRoutes = require('./modules/users/users.routes');
const subscribersRoutes = require('./modules/subscribers/subscribers.routes');
const contactRoutes = require('./modules/contact/contact.routes');
const mediaRoutes = require('./modules/media/media.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const complianceRoutes = require('./modules/compliance/compliance.routes');
const consentRoutes = require('./modules/consent/consent.routes');
const opsRoutes = require('./modules/ops/ops.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const seoRoutes = require('./modules/seo/seo.routes');
const seoPublicRoutes = require('./modules/seo/seo.public.routes');
const { localeMiddleware } = require('./middlewares/locale.middleware');

const app = express();
app.set('trust proxy', config.trustProxy);

// ============================================
// MIDDLEWARES
// ============================================

// Security
app.use(helmet());

// ============================================
// PROMETHEUS METRICS
// ============================================

// Đo duration/count mỗi request TRƯỚC khi xử lý
app.use(metricsMiddleware);

// Endpoint để Prometheus scrape — CHỈ nội bộ cluster, không expose qua Ingress
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err.message);
    }
});

// CORS
app.use(
    cors({
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            if (
                config.corsOrigin.includes(origin) ||
                origin.endsWith('.workers.dev') ||
                origin.endsWith('.dailydevops.blog')
            ) {
                return callback(null, true);
            }

            return callback(new Error(`CORS origin not allowed: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Locale'],
    })
);

// Body parsers (skip if already parsed by Cloudflare Worker bridge)
app.use((req, res, next) => {
    if (req._workerParsedBody) {
        return next();
    }
    return express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
    if (req._workerParsedBody) {
        return next();
    }
    return express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});
app.use(cookieParser());
// Resolve request locale from query param > x-locale header > cookie > default.
// Injects req.locale so all route handlers are locale-agnostic.
app.use(localeMiddleware);

// Static files (uploaded images, thumbnails) - only on Node filesystem
if (!globalThis.__CF_ENV) {
    app.use(
        '/uploads',
        express.static(path.join(__dirname, '../public/uploads'), {
            setHeaders(res) {
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                res.setHeader('Access-Control-Allow-Origin', '*');
            },
        })
    );
}

// Detailed Logging
app.use(requestLogger(config.nodeEnv, config.log));

// Rate limiting (skipped on Cloudflare Workers where edge rate limiting applies)
if (!globalThis.__CF_ENV) {
    const limiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.maxRequests,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(`/${config.apiPrefix}/`, limiter);
}

// ============================================
// PUBLIC SEO ROUTES (before rate-limited API routes)
// Sitemap data & post metadata — no auth, cached
// ============================================
app.use(`/${config.apiPrefix}/seo`, seoPublicRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
    const mem = typeof process.memoryUsage === 'function' ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0 };
    const uptime = typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0;
    res.status(200).json({
        success: true,
        message: 'DevOps Blog API is running',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        runtime: globalThis.__CF_ENV ? 'cloudflare-workers' : 'nodejs',
        uptime,
        memory: {
            heapUsed: Math.round((mem.heapUsed || 0) / 1024 / 1024) + 'MB',
            heapTotal: Math.round((mem.heapTotal || 0) / 1024 / 1024) + 'MB',
        },
    });
});

// ============================================
// API ROUTES
// ============================================

app.use(`/${config.apiPrefix}/auth`, authRoutes);
app.use(`/${config.apiPrefix}/posts`, postsRoutes);
app.use(`/${config.apiPrefix}/categories`, categoriesRoutes);
app.use(`/${config.apiPrefix}/tags`, tagsRoutes);
app.use(`/${config.apiPrefix}/comments`, commentsRoutes);
app.use(`/${config.apiPrefix}/users`, usersRoutes);
app.use(`/${config.apiPrefix}/subscribers`, subscribersRoutes);
app.use(`/${config.apiPrefix}/contact`, contactRoutes);
app.use(`/${config.apiPrefix}/media`, mediaRoutes);
app.use(`/${config.apiPrefix}/analytics`, analyticsRoutes);
app.use(`/${config.apiPrefix}/compliance`, complianceRoutes);
app.use(`/${config.apiPrefix}/consent`, consentRoutes);
app.use(`/${config.apiPrefix}/ops`, opsRoutes);
app.use(`/${config.apiPrefix}/settings`, settingsRoutes);
app.use(`/${config.apiPrefix}/seo`, seoRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
