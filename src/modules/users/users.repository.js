const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class UsersRepository {
    findMany(params) {
        return prisma.user.findMany(params);
    }

    count(params) {
        return prisma.user.count(params);
    }

    groupBy(params) {
        return prisma.user.groupBy(params);
    }

    findUnique(params) {
        return prisma.user.findUnique(params);
    }

    update(params) {
        return prisma.user.update(params);
    }

    delete(params) {
        return prisma.user.delete(params);
    }

    findPosts(params) {
        return prisma.post.findMany(params);
    }

    findComments(params) {
        return prisma.comment.findMany(params);
    }

    findSubscriber(params) {
        return prisma.subscriber.findUnique(params);
    }
}

module.exports = new UsersRepository();
