const morgan = require('morgan');

const REDACTED_VALUE = '[REDACTED]';

const c = {
    Reset: '\x1b[0m',
    Bold: '\x1b[1m',
    Green: '\x1b[32m',
    Red: '\x1b[31m',
    Yellow: '\x1b[33m',
    Blue: '\x1b[34m',
    Magenta: '\x1b[35m',
    Cyan: '\x1b[36m',
    White: '\x1b[37m',
    Gray: '\x1b[90m',
};

const captureResponseBody = (req, res, next) => {
    const originalJson = res.json;
    const originalSend = res.send;

    res.json = function (body) {
        res.locals.responseBody = body;
        return originalJson.call(this, body);
    };

    res.send = function (body) {
        if (!res.locals.responseBody) {
            try {
                res.locals.responseBody = JSON.parse(body);
            } catch (error) {
                res.locals.responseBody = body;
            }
        }

        return originalSend.call(this, body);
    };

    next();
};

const maskSensitiveFields = (data) => {
    if (!data || typeof data !== 'object') return data;

    const clone = { ...data };
    if (clone.password) clone.password = REDACTED_VALUE;
    if (clone.passwordConfirm) clone.passwordConfirm = REDACTED_VALUE;
    if (clone.refreshToken) clone.refreshToken = REDACTED_VALUE;
    return clone;
};

const customTextFormat = (tokens, req, res) => {
    const method = tokens.method(req, res);
    const url = tokens.url(req, res).split('?')[0];
    const status = Number(tokens.status(req, res));
    const time = tokens['response-time'](req, res);
    const methodColor = c.Bold + (method === 'GET' ? c.Blue : method === 'POST' ? c.Green : method === 'PUT' ? c.Yellow : c.Magenta);
    const statusColor = status >= 500 ? c.Red : status >= 400 ? c.Yellow : status >= 300 ? c.Cyan : c.Green;
    const reqQuery = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : 'None';
    const reqBody = (req.body && Object.keys(req.body).length > 0) ? JSON.stringify(maskSensitiveFields(req.body)) : 'None';

    let resBodyStr = 'None';
    if (res.locals.responseBody) {
        const outputStr = JSON.stringify(res.locals.responseBody);
        resBodyStr = outputStr.length > 500 ? `${outputStr.substring(0, 500)}... [TRUNCATED TO SAVE SPACE]` : outputStr;
    }

    const d = new Date();
    const timeString = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    const divider = `${c.Gray}=====================================================================${c.Reset}`;

    return `
${divider}
${c.Bold}${c.White}[${timeString}] REQUEST:${c.Reset} ${methodColor}${method}${c.Reset} ${c.Cyan}${url}${c.Reset}
${c.Gray}|- ${c.White}Query Params : ${c.Yellow}${reqQuery}${c.Reset}
${c.Gray}\\- ${c.White}Body Payload : ${c.Yellow}${reqBody}${c.Reset}

${c.Bold}${c.White}[${timeString}] RESPONSE:${c.Reset}
${c.Gray}|- ${c.White}Status Code  : ${statusColor}${c.Bold}${status}${c.Reset} ${c.Gray}(response time: ${time} ms)${c.Reset}
${c.Gray}\\- ${c.White}Data Returned: ${statusColor}${resBodyStr}${c.Reset}
${divider}`;
};

const jsonFormat = (tokens, req, res) => {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        request: {
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            query: req.query,
            body: maskSensitiveFields(req.body),
            ip: tokens['remote-addr'](req, res),
            userAgent: tokens['user-agent'](req, res),
        },
        response: {
            status: Number(tokens.status(req, res)),
            executionTimeMs: Number(tokens['response-time'](req, res)),
            body: res.locals.responseBody,
        },
    });
};

const shouldSkipRequestLog = (req, options = {}) => {
    if (options.skipHealthChecks && req.path === '/health') {
        return true;
    }

    if (options.onlyApiRequests) {
        return !req.path.startsWith('/api/');
    }

    return false;
};

const requestLogger = (env, options = {}) => {
    const format = options.format || (env === 'development' ? 'pretty' : 'json');
    const loggerOptions = {
        skip: (req) => shouldSkipRequestLog(req, options),
    };

    return [
        captureResponseBody,
        format === 'pretty'
            ? morgan(customTextFormat, loggerOptions)
            : morgan(jsonFormat, loggerOptions),
    ];
};

module.exports = {
    requestLogger,
};
