const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class TranslationJobsRepository {
    create(data) {
        return prisma.translationJob.create({ data });
    }

    findById(id) {
        return prisma.translationJob.findUnique({ where: { id } });
    }

    findLatestForPost(postId, locale = 'en') {
        return prisma.translationJob.findFirst({
            where: { postId, locale },
            orderBy: { createdAt: 'desc' },
        });
    }

    findFirst(params) {
        return prisma.translationJob.findFirst(params);
    }

    update(id, data) {
        return prisma.translationJob.update({
            where: { id },
            data,
        });
    }

    updateMany(params) {
        return prisma.translationJob.updateMany(params);
    }

    deleteMany(params) {
        return prisma.translationJob.deleteMany(params);
    }
}

module.exports = new TranslationJobsRepository();
