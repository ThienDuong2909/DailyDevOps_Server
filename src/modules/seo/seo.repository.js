const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class SeoRepository {
    findGlobalSettings(args = {}) {
        return prisma.seoSetting.findMany(args);
    }

    upsertSeoSetting(args) {
        return prisma.seoSetting.upsert(args);
    }

    findSystemSettings(args = {}) {
        return prisma.systemSetting.findMany(args);
    }

    upsertSystemSetting(args) {
        return prisma.systemSetting.upsert(args);
    }

    findPublishedPosts(args = {}) {
        return prisma.post.findMany(args);
    }
}

module.exports = new SeoRepository();
