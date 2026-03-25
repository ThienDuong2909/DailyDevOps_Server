const app = require('./app');
const config = require('./config');
const { disconnectPrisma } = require('./database/prisma');

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

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');
        await disconnectPrisma();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');
        await disconnectPrisma();
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    server.close(async () => {
        await disconnectPrisma();
        process.exit(1);
    });
});
