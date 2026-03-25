const { PrismaClient } = require('@prisma/client');

let prisma;

function getPrismaClient() {
    if (!prisma) {
        prisma = new PrismaClient({
            log: ['error'],
        });
    }

    return prisma;
}

async function disconnectPrisma() {
    if (prisma) {
        await prisma.$disconnect();
    }
}

module.exports = {
    getPrismaClient,
    disconnectPrisma,
};
