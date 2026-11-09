const { PrismaClient } = require('@prisma/client');
const { PrismaD1 } = require('@prisma/adapter-d1');

let prismaInstance;
let currentD1Binding;

function initD1Prisma(d1Binding) {
    if (!d1Binding) return;
    if (!prismaInstance || currentD1Binding !== d1Binding) {
        currentD1Binding = d1Binding;
        const adapter = new PrismaD1(d1Binding);
        prismaInstance = new PrismaClient({ adapter });
    }
}

function getRawPrismaClient() {
    if (!prismaInstance) {
        if (globalThis.__CF_D1_BINDING) {
            initD1Prisma(globalThis.__CF_D1_BINDING);
        } else {
            prismaInstance = new PrismaClient({
                log: ['error'],
            });
        }
    }
    return prismaInstance;
}

const prismaProxy = new Proxy(
    {},
    {
        get(_target, prop) {
            const client = getRawPrismaClient();
            const value = client[prop];
            return typeof value === 'function' ? value.bind(client) : value;
        },
    }
);

function getPrismaClient() {
    return prismaProxy;
}

async function disconnectPrisma() {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
    }
}

module.exports = {
    initD1Prisma,
    getPrismaClient,
    disconnectPrisma,
};
