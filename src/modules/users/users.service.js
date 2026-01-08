const argon2 = require('argon2');
const { getPrismaClient } = require('../../utils/prisma');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../middlewares/error.middleware');

const prisma = getPrismaClient();

class UsersService {
    /**
     * Find all users
     */
    async findAll(query = {}) {
        const { page = 1, limit = 10, role, search } = query;
        const skip = (page - 1) * limit;

        const where = {
            ...(role && { role }),
            ...(search && {
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    bio: true,
                    role: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                    _count: {
                        select: { posts: true, comments: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find user by ID
     */
    async findById(id) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                bio: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: { posts: true, comments: true },
                },
            },
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
        const user = await this.findById(id);

        // Only user themselves or admin can update
        if (id !== currentUserId && currentUserRole !== 'ADMIN') {
            throw new ForbiddenError('You can only update your own profile');
        }

        // Only admin can change role
        if (dto.role && currentUserRole !== 'ADMIN') {
            throw new ForbiddenError('Only admin can change user role');
        }

        // If changing password, hash it
        if (dto.password) {
            dto.password = await argon2.hash(dto.password);
        }

        return prisma.user.update({
            where: { id },
            data: dto,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                bio: true,
                role: true,
                isActive: true,
            },
        });
    }

    /**
     * Delete user
     */
    async delete(id, currentUserId, currentUserRole) {
        const user = await this.findById(id);

        // Only admin can delete users
        if (currentUserRole !== 'ADMIN') {
            throw new ForbiddenError('Only admin can delete users');
        }

        // Cannot delete yourself
        if (id === currentUserId) {
            throw new ForbiddenError('You cannot delete your own account');
        }

        await prisma.user.delete({ where: { id } });

        return { message: 'User deleted successfully' };
    }
}

module.exports = new UsersService();
