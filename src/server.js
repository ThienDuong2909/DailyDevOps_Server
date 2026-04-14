const app = require('./app');
const config = require('./config');
const { disconnectPrisma } = require('./database/prisma');
const postsScheduler = require('./modules/posts/posts.scheduler');
const thumbnailGenerationService = require('./modules/posts/posts.thumbnail-generation.service');
const { initSentry, captureException } = require('./common/observability/sentry');

initSentry();

const port = config.port;

const server = app.listen(port, () => {
    console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║   🚀 DevOps Blog API Server                                  ║
  ║                                                              ║
  ║   Server running at:    http://localhost:${port}               ║
  ║   API Documentation:    http://localhost:${port}/${config.apiPrefix}/docs     ║
  ║   Environment:          ${config.nodeEnv.padEnd(11)}                       ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
  `);
});

// Configure long timeouts for AI formatting (6 minutes)
server.setTimeout(360000);
server.keepAliveTimeout = 360000;
server.headersTimeout = 361000;

postsScheduler.start();
thumbnailGenerationService.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await postsScheduler.stop();
    await thumbnailGenerationService.stop();
    server.close(async () => {
        console.log('HTTP server closed');
        await disconnectPrisma();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    await postsScheduler.stop();
    await thumbnailGenerationService.stop();
    server.close(async () => {
        console.log('HTTP server closed');
        await disconnectPrisma();
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    captureException(err, { source: 'process.unhandledRejection' });
    void postsScheduler.stop();
    void thumbnailGenerationService.stop();
    server.close(async () => {
        await disconnectPrisma();
        process.exit(1);
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    captureException(err, { source: 'process.uncaughtException' });
    void postsScheduler.stop();
    void thumbnailGenerationService.stop();
    server.close(async () => {
        await disconnectPrisma();
        process.exit(1);
    });
});
