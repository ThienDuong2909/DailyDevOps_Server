const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class CategoriesRepository {
    findMany(params) {
        return prisma.category.findMany(params);
    }

    findUnique(params) {
        return prisma.category.findUnique(params);
    }

    create(params) {
        return prisma.category.create(params);
    }

    update(params) {
        return prisma.category.update(params);
    }

    delete(params) {
        return prisma.category.delete(params);
    }
}

module.exports = new CategoriesRepository();
