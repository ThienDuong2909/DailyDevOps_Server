const { NotFoundError } = require('../../middlewares/error.middleware');
const usersRepository = require('./users.repository');
const {
    buildPaginatedUsersResponse,
    buildUpdateUserData,
    buildUsersListQuery,
    ensureRoleCanBeChanged,
    ensureUserCanBeDeleted,
    ensureUserCanUpdate,
} = require('./users.helpers');
const { userDetailSelect, userListSelect, userWriteSelect } = require('./users.queries');

class UsersService {
    async getStats() {
        const [total, active, roleStats] = await Promise.all([
            usersRepository.count(),
            usersRepository.count({ where: { isActive: true } }),
            usersRepository.groupBy({
                by: ['role'],
                _count: true,
            }),
        ]);

        return {
            total,
            active,
            byRole: roleStats.reduce((acc, current) => {
                acc[current.role] = current._count;
                return acc;
            }, {}),
        };
    }

    /**
     * Find all users
     */
    async findAll(query = {}) {
        const { page, limit, skip, where } = buildUsersListQuery(query);

        const [users, total] = await Promise.all([
            usersRepository.findMany({
                where,
                skip,
                take: limit,
                select: userListSelect,
                orderBy: { createdAt: 'desc' },
            }),
            usersRepository.count({ where }),
        ]);

        return buildPaginatedUsersResponse({ data: users, total, page, limit });
    }

    /**
     * Find user by ID
     */
    async findById(id) {
        const user = await usersRepository.findUnique({
            where: { id },
            select: userDetailSelect,
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return user;
    }

    /**
     * Update user
     */
    async update(id, dto, currentUserId, currentUserRole) {
        await this.findById(id);

        ensureUserCanUpdate(id, currentUserId, currentUserRole);
        ensureRoleCanBeChanged(dto, currentUserRole);
        const updateData = await buildUpdateUserData(dto);

        return usersRepository.update({
            where: { id },
            data: updateData,
            select: userWriteSelect,
        });
    }

    /**
     * Delete user
     */
    async delete(id, currentUserId, currentUserRole) {
        await this.findById(id);
        ensureUserCanBeDeleted(id, currentUserId, currentUserRole);

        await usersRepository.delete({ where: { id } });

        return { message: 'User deleted successfully' };
    }
}

module.exports = new UsersService();
