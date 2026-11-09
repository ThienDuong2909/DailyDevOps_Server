// Optional Prometheus metrics — gracefully no-ops on Cloudflare Workers if prom-client is unsupported
let register = {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    async metrics() {
        return '# Metrics collection running in serverless mode\n';
    },
};

let metricsMiddleware = (_req, _res, next) => next();

let metrics = {
    blogPostsViewed: { labels: () => ({ inc: () => {} }), inc: () => {} },
    authEventsTotal: { labels: () => ({ inc: () => {} }), inc: () => {} },
    apiErrorsTotal: { labels: () => ({ inc: () => {} }), inc: () => {} },
};

try {
    const client = require('prom-client');
    const reg = new client.Registry();

    if (!globalThis.__CF_ENV && typeof process.uptime === 'function') {
        try {
            client.collectDefaultMetrics({
                register: reg,
                prefix: 'nodejs_',
                gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
            });
        } catch {
            // Ignore in edge runtimes
        }
    }

    const httpRequestsTotal = new client.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
        registers: [reg],
    });

    const httpRequestDurationMs = new client.Histogram({
        name: 'http_request_duration_ms',
        help: 'HTTP request duration in milliseconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        registers: [reg],
    });

    const httpRequestsInProgress = new client.Gauge({
        name: 'http_requests_in_progress',
        help: 'Number of HTTP requests currently being processed',
        labelNames: ['method', 'route'],
        registers: [reg],
    });

    const blogPostsViewed = new client.Counter({
        name: 'blog_posts_viewed_total',
        help: 'Total number of blog posts viewed',
        labelNames: ['slug'],
        registers: [reg],
    });

    const authEventsTotal = new client.Counter({
        name: 'blog_auth_events_total',
        help: 'Total number of authentication events',
        labelNames: ['type', 'result'],
        registers: [reg],
    });

    const apiErrorsTotal = new client.Counter({
        name: 'blog_api_errors_total',
        help: 'Total number of API errors by type',
        labelNames: ['route', 'status_code', 'error_type'],
        registers: [reg],
    });

    const resolveMetricsRoute = (req) => {
        return req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path;
    };

    register = reg;
    metrics = {
        blogPostsViewed,
        authEventsTotal,
        apiErrorsTotal,
    };

    metricsMiddleware = (req, res, next) => {
        const start = Date.now();
        const method = req.method;
        const inProgressRoute = req.path;

        httpRequestsInProgress.labels(method, inProgressRoute).inc();

        res.on('finish', () => {
            const route = resolveMetricsRoute(req);
            const statusCode = res.statusCode.toString();
            const duration = Date.now() - start;

            httpRequestsTotal.labels(method, route, statusCode).inc();
            httpRequestDurationMs.labels(method, route, statusCode).observe(duration);
            httpRequestsInProgress.labels(method, inProgressRoute).dec();

            if (res.statusCode >= 400) {
                apiErrorsTotal.labels(route, statusCode, res.statusCode >= 500 ? 'server' : 'client').inc();
            }
        });

        next();
    };
} catch {
    // Fallback to no-op metrics
}

module.exports = {
    register,
    metricsMiddleware,
    metrics,
};
