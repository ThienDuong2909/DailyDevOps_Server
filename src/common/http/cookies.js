const config = require('../../config');

const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

module.exports = {
    refreshTokenCookieOptions,
};
