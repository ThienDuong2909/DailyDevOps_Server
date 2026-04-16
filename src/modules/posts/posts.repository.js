const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class PostsRepository {
    get prisma() {
        return prisma;
    }

    findMany(params) {
        return prisma.post.findMany(params);
    }

    count(params) {
        return prisma.post.count(params);
    }

    findUnique(params) {
        return prisma.post.findUnique(params);
    }

    findFirst(params) {
        return prisma.post.findFirst(params);
    }

    create(params) {
        return prisma.post.create(params);
    }

    update(params) {
        return prisma.post.update(params);
    }

    updateMany(params) {
        return prisma.post.updateMany(params);
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

    findManyVersions(params) {
        return prisma.postVersion.findMany(params);
    }

    findUniqueVersion(params) {
        return prisma.postVersion.findUnique(params);
    }

    createVersion(params) {
        return prisma.postVersion.create(params);
    }

    deleteManyVersions(params) {
        return prisma.postVersion.deleteMany(params);
    }

    findManyTranslations(params) {
        return prisma.postTranslation.findMany(params);
    }

    findUniqueTranslation(params) {
        return prisma.postTranslation.findUnique(params);
    }

    findFirstTranslation(params) {
        return prisma.postTranslation.findFirst(params);
    }

    createTranslation(params) {
        return prisma.postTranslation.create(params);
    }

    upsertTranslation(params) {
        return prisma.postTranslation.upsert(params);
    }

    updateTranslation(params) {
        return prisma.postTranslation.update(params);
    }

    deleteTranslation(params) {
        return prisma.postTranslation.delete(params);
    }
}

module.exports = new PostsRepository();
