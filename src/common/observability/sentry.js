const config = require('../../config');

let initialized = false;
let Sentry = null;

function isSentryEnabled() {
    return Boolean(config.sentry?.dsn);
}

function getSentry() {
    if (!Sentry && isSentryEnabled()) {
        try {
            Sentry = require('@sentry/node');
        } catch {
            Sentry = null;
        }
    }
    return Sentry;
}

function initSentry() {
    if (initialized || !isSentryEnabled()) {
        return;
    }

    const sentryClient = getSentry();
    if (!sentryClient) return;

    try {
        sentryClient.init({
            dsn: config.sentry.dsn,
            environment: config.nodeEnv,
            tracesSampleRate: config.sentry.tracesSampleRate,
        });
        initialized = true;
    } catch {
        // Ignore initialization errors in edge runtime
    }
}

function captureException(error, context = {}) {
    if (!isSentryEnabled()) {
        return;
    }

    const sentryClient = getSentry();
    if (!sentryClient) return;

    try {
        sentryClient.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
            sentryClient.captureException(error);
        });
    } catch {
        // Ignore
    }
}

module.exports = {
    initSentry,
    captureException,
    isSentryEnabled,
};
