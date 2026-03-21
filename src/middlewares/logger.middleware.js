const morgan = require('morgan');

// Token lấy request body (ẩn các trường nhạy cảm)
morgan.token('req-body', (req) => {
    if (!req.body || Object.keys(req.body).length === 0) return '';
    const body = { ...req.body };
    if (body.password) body.password = '[MASKED]';
    if (body.refreshToken) body.refreshToken = '[MASKED]';
    return JSON.stringify(body);
});

// Token lấy request query
morgan.token('req-query', (req) => {
    if (!req.query || Object.keys(req.query).length === 0) return '';
    return JSON.stringify(req.query);
});

// Format log dạng Text (Đẹp, dễ đọc khi dev hoặc check log console server)
const customTextFormat = (tokens, req, res) => {
    const method = tokens.method(req, res);
    const url = tokens.url(req, res).split('?')[0]; // Tách URL gốc không chứa query
    const status = tokens.status(req, res);
    const responseTime = tokens['response-time'](req, res);
    const ip = tokens['remote-addr'](req, res);
    const body = tokens['req-body'](req, res);
    const query = tokens['req-query'](req, res);
    
    let log = `[${new Date().toISOString()}] ${ip} - ${method} ${url} | Status: ${status} | Execution: ${responseTime}ms`;
    
    if (query) log += ` | Query: ${query}`;
    if (body) log += ` | Body payload: ${body}`;
    
    return log;
};

// Format log dạng JSON (Tối ưu cho Loki, Elasticsearch trên Production)
const jsonFormat = (tokens, req, res) => {
    const body = { ...req.body };
    if (body.password) body.password = '[MASKED]';
    if (body.refreshToken) body.refreshToken = '[MASKED]';

    return JSON.stringify({
        timestamp: new Date().toISOString(),
        request: {
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            query: req.query,
            body: Object.keys(body).length > 0 ? body : undefined,
            ip: tokens['remote-addr'](req, res),
            userAgent: tokens['user-agent'](req, res),
        },
        response: {
            status: Number(tokens.status(req, res)),
            executionTimeMs: Number(tokens['response-time'](req, res)),
            contentLengthBytes: Number(tokens.res(req, res, 'content-length')) || 0
        }
    });
};

const requestLogger = (env) => {
    // Nếu là dev trả về text cho dễ đọc, nếu là prod trả về JSON cho Loki/Promtail monitor
    return env === 'development' ? morgan(customTextFormat) : morgan(jsonFormat);
};

module.exports = {
    requestLogger
};
