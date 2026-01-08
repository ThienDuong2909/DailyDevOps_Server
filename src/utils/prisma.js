const { PrismaClient } = require('@prisma/client');

// Singleton instance của Prisma Client
let prisma;

function getPrismaClient() {
    if (!prisma) {
        prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
        });
    }
    return prisma;
}

// Graceful shutdown
async function disconnectPrisma() {
    if (prisma) {
        await prisma.$disconnect();
    }
}

module.exports = {
    getPrismaClient,
    disconnectPrisma,
};
