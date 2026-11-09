let waitUntilFn = null;

function setWaitUntil(fn) {
    waitUntilFn = typeof fn === 'function' ? fn : null;
}

function runInBackground(taskFn) {
    const promise = Promise.resolve()
        .then(() => taskFn())
        .catch((err) => {
            console.error('[BackgroundTask] Unhandled error:', err?.message || err);
        });

    if (waitUntilFn) {
        try {
            waitUntilFn(promise);
        } catch {
            // Ignore if executionContext is no longer active
        }
    }

    return promise;
}

module.exports = {
    setWaitUntil,
    runInBackground,
};
