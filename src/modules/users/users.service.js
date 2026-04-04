const { NotFoundError } = require('../../middlewares/error.middleware');
const { getPrismaClient } = require('../../database/prisma');
const usersRepository = require('./users.repository');
const { sendDeleteAccountRequestEmail } = require('./users.mailer');
const {
    buildPaginatedUsersResponse,
    buildPublicUsername,
    buildUpdateUserData,
    buildUsersListQuery,
    ensureRoleCanBeChanged,
    ensureUserCanBeDeleted,
    ensureUserCanUpdate,
} = require('./users.helpers');
const { publicAuthorSelect, userDetailSelect, userListSelect, userWriteSelect } = require('./users.queries');
const { serializePosts } = require('../posts/posts.helpers');

const prisma = getPrismaClient();

class UsersService {
    async exportPersonalData(userId) {
        const user = await usersRepository.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                bio: true,
                role: true,
                isActive: true,
                emailVerifiedAt: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const [posts, comments, subscriber] = await Promise.all([
            usersRepository.findPosts({
                where: { authorId: userId },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    status: true,
                    publishedAt: true,
                    scheduledAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            usersRepository.findComments({
                where: { userId },
                select: {
                    id: true,
                    content: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    post: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            usersRepository.findSubscriber({
                where: { email: user.email },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    status: true,
                    isActive: true,
                    confirmedAt: true,
                    subscribedAt: true,
                    unsubscribedAt: true,
                },
            }),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            user,
            posts,
            comments,
            newsletter: subscriber,
        };

        await prisma.activityLog.create({
            data: {
                action: 'DATA_EXPORT_REQUEST',
                entity: 'Privacy',
                entityId: user.id,
                userId: user.id,
                userEmail: user.email,
                details: JSON.stringify({
                    exportedAt: payload.exportedAt,
                    postsCount: posts.length,
                    commentsCount: comments.length,
                    newsletterStatus: subscriber?.status || null,
                }),
            },
        });

        return payload;
    }

    async requestAccountDeletion(userId, reason) {
        const user = await usersRepository.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const mailResult = await sendDeleteAccountRequestEmail({
            user,
            reason,
        });

        await prisma.activityLog.create({
            data: {
                action: 'ACCOUNT_DELETION_REQUEST',
                entity: 'Privacy',
                entityId: user.id,
                userId: user.id,
                userEmail: user.email,
                details: JSON.stringify({
                    reason: reason || null,
                    role: user.role,
                    emailDelivered: !mailResult?.skipped,
                    requestedAt: new Date().toISOString(),
                }),
            },
        });

        return {
            message: mailResult?.skipped
                ? 'Deletion request recorded, but email delivery is not configured.'
                : 'Deletion request sent to the support inbox for review.',
        };
    }

    async findPublicAuthorByUsername(username) {
        const users = await usersRepository.findMany({
            where: {
                isActive: true,
                role: {
                    in: ['ADMIN', 'EDITOR', 'AUTHOR', 'MODERATOR'],
                },
            },
            select: publicAuthorSelect,
        });

        const matchedUser = users.find(
            (user) => buildPublicUsername(user) === username
        );

        if (!matchedUser) {
            throw new NotFoundError('Author not found');
        }

        return {
            id: matchedUser.id,
            username: buildPublicUsername(matchedUser),
            firstName: matchedUser.firstName,
            lastName: matchedUser.lastName,
            avatar: matchedUser.avatar,
            bio: matchedUser.bio,
            role: matchedUser.role,
            createdAt: matchedUser.createdAt,
            posts: serializePosts(matchedUser.posts || []),
        };
    }

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
