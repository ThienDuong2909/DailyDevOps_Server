const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class SubscribersRepository {
    findUnique(params) {
        return prisma.subscriber.findUnique(params);
    }

    findUniqueOrThrow(params) {
        return prisma.subscriber.findUniqueOrThrow(params);
    }

    findFirst(params) {
        return prisma.subscriber.findFirst(params);
    }

    findMany(params) {
        return prisma.subscriber.findMany(params);
    }

    count(params) {
        return prisma.subscriber.count(params);
    }

    create(params) {
        return prisma.subscriber.create(params);
    }

    update(params) {
        return prisma.subscriber.update(params);
    }

    delete(params) {
        return prisma.subscriber.delete(params);
    }
}

module.exports = new SubscribersRepository();
