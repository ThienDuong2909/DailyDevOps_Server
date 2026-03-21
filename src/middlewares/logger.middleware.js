const morgan = require('morgan');

// ============================================
// BẢNG MÀU ANSI (DÀNH CHO CHUẨN TERMINAL)
// ============================================
const c = {
    Reset: "\x1b[0m",
    Bold: "\x1b[1m",
    Green: "\x1b[32m",
    Red: "\x1b[31m",
    Yellow: "\x1b[33m",
    Blue: "\x1b[34m",
    Magenta: "\x1b[35m",
    Cyan: "\x1b[36m",
    White: "\x1b[37m",
    Gray: "\x1b[90m"
};

// ============================================
// MIDDLEWARE TRUNG GIAN BẮT DATA RESPONSE
// ============================================
// Morgan mặc định chỉ bắt thông tin header của request. Do đó tạo hàm trung gian chèn vào giữa
// vòng đời Express để copy lại dữ liệu Body Respone lúc chuẩn bị gọi hàm `res.json()`
const captureResponseBody = (req, res, next) => {
    const originalJson = res.json;
    const originalSend = res.send;

    res.json = function (body) {
        res.locals.responseBody = body; // Lưu lại response
        return originalJson.call(this, body);
    };

    res.send = function (body) {
        if (!res.locals.responseBody) {
            try { res.locals.responseBody = JSON.parse(body); } 
            catch (e) { res.locals.responseBody = body; } // Phục vụ Text/Blob string
        }
        return originalSend.call(this, body);
    };

    next();
};

// ============================================
// CHE DỮ LIỆU NHẠY CẢM NHƯ PASSWORD, TOKENS
// ============================================
const maskSensitiveFields = (data) => {
    if (!data || typeof data !== 'object') return data;
    const clone = { ...data };
    if (clone.password) clone.password = '[MASKED_FOR_SECURITY]';
    if (clone.passwordConfirm) clone.passwordConfirm = '[MASKED_FOR_SECURITY]';
    if (clone.refreshToken) clone.refreshToken = '[MASKED_FOR_SECURITY]';
    return clone;
};

// ============================================
// FORMAT LOG CÓ MÀU SẮC, RÕ RÀNG TRONG LOCAL
// ============================================
const customTextFormat = (tokens, req, res) => {
    const method = tokens.method(req, res);
    const url = tokens.url(req, res).split('?')[0];
    const status = tokens.status(req, res);
    const time = tokens['response-time'](req, res);
    
    // Quy tắc tô cho HTTP Method
    const methodColor = c.Bold + (method === 'GET' ? c.Blue : method === 'POST' ? c.Green : method === 'PUT' ? c.Yellow : c.Magenta);
    
    // Quy tắc tô cho HTTP Status (200 Xanh, 400 Vàng, 500 Đỏ)
    const statusColor = status >= 500 ? c.Red : status >= 400 ? c.Yellow : status >= 300 ? c.Cyan : c.Green;
    
    const reqQuery = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : 'None';
    const reqBody = (req.body && Object.keys(req.body).length > 0) ? JSON.stringify(maskSensitiveFields(req.body)) : 'None';
    
    // Giòn giã chuỗi Response (Nếu response quá dài ví dụ >1500 kí tự thì cắt bớt để không trôi hết màn hình)
    let resBodyStr = 'None';
    if (res.locals.responseBody) {
        let outputStr = JSON.stringify(res.locals.responseBody);
        resBodyStr = outputStr.length > 500 ? outputStr.substring(0, 500) + '... [TRUNCATED TO SAVE SPACE]' : outputStr;
    }

    const d = new Date();
    const timeString = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    const divider = `${c.Gray}═════════════════════════════════════════════════════════════════════${c.Reset}`;
    
    return `
${divider}
${c.Bold}${c.White}[${timeString}] 🌐 REQUEST:${c.Reset} ${methodColor}${method}${c.Reset} ${c.Cyan}${url}${c.Reset}
${c.Gray}├─ ${c.White}Query Params : ${c.Yellow}${reqQuery}${c.Reset}
${c.Gray}└─ ${c.White}Body Payload : ${c.Yellow}${reqBody}${c.Reset}

${c.Bold}${c.White}[${timeString}] 📤 RESPONSE:${c.Reset}
${c.Gray}├─ ${c.White}Status Code  : ${statusColor}${c.Bold}${status}${c.Reset} ${c.Gray}(thời gian xử lý: ${time} ms)${c.Reset}
${c.Gray}└─ ${c.White}Data Returned: ${statusColor}${resBodyStr}${c.Reset}
${divider}`;
};

// ============================================
// FORMAT LOG JSON KHÔNG MÀU (GIÚP CHO CLOUD)
// ============================================
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
            body: res.locals.responseBody
        }
    });
};

const requestLogger = (env) => {
    return [
        captureResponseBody,
        env === 'development' ? morgan(customTextFormat) : morgan(jsonFormat)
    ];
};

module.exports = {
    requestLogger
};
