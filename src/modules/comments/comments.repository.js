const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class CommentsRepository {
    findMany(params) {
        return prisma.comment.findMany(params);
    }

    count(params) {
        return prisma.comment.count(params);
    }

    groupBy(params) {
        return prisma.comment.groupBy(params);
    }

    findUnique(params) {
        return prisma.comment.findUnique(params);
    }

    create(params) {
        return prisma.comment.create(params);
    }

    update(params) {
        return prisma.comment.update(params);
    }

    delete(params) {
        return prisma.comment.delete(params);
    }
}

module.exports = new CommentsRepository();
