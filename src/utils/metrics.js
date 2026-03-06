const client = require('prom-client');

// ============================================================
// Prometheus Metrics Registry — DevOps Blog Server
// Được scrape bởi Prometheus mỗi 15s qua endpoint /metrics
// ============================================================

// Enable default Node.js metrics (heap, GC, event loop, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({
    register,
    prefix: 'nodejs_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ── HTTP Request Counter ──────────────────────────────────────
// Đếm tổng số requests theo method, route, status code
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

// ── HTTP Request Duration Histogram ──────────────────────────
// Đo latency của từng request — dùng để tính P50/P95/P99
const httpRequestDurationMs = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register],
});

// ── Requests In Progress ──────────────────────────────────────
// Gauge: số requests đang được xử lý tại thời điểm hiện tại
const httpRequestsInProgress = new client.Gauge({
    name: 'http_requests_in_progress',
    help: 'Number of HTTP requests currently being processed',
    labelNames: ['method', 'route'],
    registers: [register],
});

// ── Business Metrics ──────────────────────────────────────────

// Blog posts viewed
const blogPostsViewed = new client.Counter({
    name: 'blog_posts_viewed_total',
    help: 'Total number of blog posts viewed',
    labelNames: ['slug'],
    registers: [register],
});

// Auth events (login/register success/fail)
const authEventsTotal = new client.Counter({
    name: 'blog_auth_events_total',
    help: 'Total number of authentication events',
    labelNames: ['type', 'result'],  // type: login|register, result: success|fail
    registers: [register],
});

// API errors by type
const apiErrorsTotal = new client.Counter({
    name: 'blog_api_errors_total',
    help: 'Total number of API errors by type',
    labelNames: ['route', 'status_code', 'error_type'],
    registers: [register],
});

// ── Express Middleware ────────────────────────────────────────
// Tự động đo time và count mỗi request đi qua Express
const metricsMiddleware = (req, res, next) => {
    // Chuẩn hóa route — thay params bằng :param để group metrics
    // /api/v1/posts/my-post-slug → /api/v1/posts/:slug
    const getRoute = (req) => {
        return req.route?.path
            ? `${req.baseUrl || ''}${req.route.path}`
            : req.path;
    };

    const start = Date.now();
    const method = req.method;

    // Tăng gauge "in progress"
    httpRequestsInProgress.labels(method, req.path).inc();

    res.on('finish', () => {
        const route = getRoute(req);
        const statusCode = res.statusCode.toString();
        const duration = Date.now() - start;

        // Record counter và histogram
        httpRequestsTotal.labels(method, route, statusCode).inc();
        httpRequestDurationMs.labels(method, route, statusCode).observe(duration);

        // Giảm gauge "in progress"
        httpRequestsInProgress.labels(method, req.path).dec();

        // Track errors
        if (res.statusCode >= 400) {
            apiErrorsTotal.labels(route, statusCode, res.statusCode >= 500 ? 'server' : 'client').inc();
        }
    });

    next();
};

module.exports = {
    register,
    metricsMiddleware,
    // Export business metrics để dùng trong các service
    metrics: {
        blogPostsViewed,
        authEventsTotal,
        apiErrorsTotal,
    },
};
