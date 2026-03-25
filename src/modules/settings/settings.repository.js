const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class SettingsRepository {
    findMany(args = {}) {
        return prisma.systemSetting.findMany(args);
    }

    upsert(args) {
        return prisma.systemSetting.upsert(args);
    }
}

module.exports = new SettingsRepository();
