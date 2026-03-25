const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class PostsRepository {
    findMany(params) {
        return prisma.post.findMany(params);
    }

    count(params) {
        return prisma.post.count(params);
    }

    findUnique(params) {
        return prisma.post.findUnique(params);
    }

    create(params) {
        return prisma.post.create(params);
    }

    update(params) {
        return prisma.post.update(params);
    }

    delete(params) {
        return prisma.post.delete(params);
    }

    groupBy(params) {
        return prisma.post.groupBy(params);
    }

    aggregate(params) {
        return prisma.post.aggregate(params);
    }
}

module.exports = new PostsRepository();
