const sendSuccess = (res, statusCode, payload = {}) => {
    return res.status(statusCode).json({
        success: true,
        ...payload,
    });
};

const sendOk = (res, payload = {}) => sendSuccess(res, 200, payload);
const sendCreated = (res, payload = {}) => sendSuccess(res, 201, payload);

const sendError = (res, statusCode, payload = {}) => {
    return res.status(statusCode).json({
        success: false,
        ...payload,
    });
};

module.exports = {
    sendSuccess,
    sendOk,
    sendCreated,
    sendError,
};
