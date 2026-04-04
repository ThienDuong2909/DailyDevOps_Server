const config = require('../../config');
const postsService = require('./posts.service');

class PostsScheduler {
    constructor() {
        this.timer = null;
        this.isRunning = false;
    }

    start() {
        if (this.timer) {
            return;
        }

        const intervalMs = config.jobs.scheduledPublishIntervalMs;

        setTimeout(() => {
            void this.runOnce();
        }, 2000);

        this.timer = setInterval(() => {
            void this.runOnce();
        }, intervalMs);

        console.log(
            `[scheduler] Scheduled publish worker started (${intervalMs}ms interval)`
        );
    }

    async stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async runOnce() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        try {
            const result = await postsService.processScheduledPublications();

            if (result.publishedCount > 0) {
                console.log(
                    `[scheduler] Published ${result.publishedCount} scheduled post(s)`
                );
            }
        } catch (error) {
            console.error('[scheduler] Failed to process scheduled posts:', error);
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = new PostsScheduler();
