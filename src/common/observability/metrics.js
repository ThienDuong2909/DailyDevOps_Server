const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
    register,
    prefix: 'nodejs_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

const httpRequestDurationMs = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register],
});

const httpRequestsInProgress = new client.Gauge({
    name: 'http_requests_in_progress',
    help: 'Number of HTTP requests currently being processed',
    labelNames: ['method', 'route'],
    registers: [register],
});

const blogPostsViewed = new client.Counter({
    name: 'blog_posts_viewed_total',
    help: 'Total number of blog posts viewed',
    labelNames: ['slug'],
    registers: [register],
});

const authEventsTotal = new client.Counter({
    name: 'blog_auth_events_total',
    help: 'Total number of authentication events',
    labelNames: ['type', 'result'],
    registers: [register],
});

const apiErrorsTotal = new client.Counter({
    name: 'blog_api_errors_total',
    help: 'Total number of API errors by type',
    labelNames: ['route', 'status_code', 'error_type'],
    registers: [register],
});

const resolveMetricsRoute = (req) => {
    return req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path;
};

const metricsMiddleware = (req, res, next) => {
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

module.exports = {
    register,
    metricsMiddleware,
    metrics: {
        blogPostsViewed,
        authEventsTotal,
        apiErrorsTotal,
    },
};
