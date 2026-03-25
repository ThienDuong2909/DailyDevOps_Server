const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class AuthRepository {
    findUserUnique(params) {
        return prisma.user.findUnique(params);
    }

    createUser(params) {
        return prisma.user.create(params);
    }

    updateUser(params) {
        return prisma.user.update(params);
    }
}

module.exports = new AuthRepository();
