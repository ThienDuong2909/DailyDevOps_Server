const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class TagsRepository {
    findMany(params) {
        return prisma.tag.findMany(params);
    }

    findUnique(params) {
        return prisma.tag.findUnique(params);
    }

    create(params) {
        return prisma.tag.create(params);
    }

    update(params) {
        return prisma.tag.update(params);
    }

    delete(params) {
        return prisma.tag.delete(params);
    }
}

module.exports = new TagsRepository();
