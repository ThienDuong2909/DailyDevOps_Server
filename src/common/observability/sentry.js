const Sentry = require('@sentry/node');
const config = require('../../config');

let initialized = false;

function isSentryEnabled() {
    return Boolean(config.sentry.dsn);
}

function initSentry() {
    if (initialized || !isSentryEnabled()) {
        return;
    }

    Sentry.init({
        dsn: config.sentry.dsn,
        environment: config.nodeEnv,
        tracesSampleRate: config.sentry.tracesSampleRate,
    });

    initialized = true;
}

function captureException(error, context = {}) {
    if (!isSentryEnabled()) {
        return;
    }

    Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });
        Sentry.captureException(error);
    });
}

module.exports = {
    initSentry,
    captureException,
    isSentryEnabled,
};
