const { getPrismaClient } = require('../../utils/prisma');
const { NotFoundError, ForbiddenError } = require('../../middlewares/error.middleware');

const prisma = getPrismaClient();

class CommentsService {
    /**
     * Find comments by post ID
     */
    async findByPostId(postId) {
        return prisma.comment.findMany({
            where: {
                postId,
                status: 'APPROVED',
                parentId: null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                replies: {
                    where: { status: 'APPROVED' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                avatar: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Create comment
     */
    async create(dto, userId, req) {
        return prisma.comment.create({
            data: {
                content: dto.content,
                postId: dto.postId,
                userId: userId || null,
                parentId: dto.parentId || null,
                authorName: dto.authorName || null,
                authorEmail: dto.authorEmail || null,
                authorIp: req.ip,
                status: 'PENDING', // Default to pending for moderation
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
            },
        });
    }

    /**
     * Update comment status (approve, spam, trash)
     */
    async updateStatus(id, status, userId, userRole) {
        const comment = await prisma.comment.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundError('Comment not found');
        }

        // Only moderators and admins can update status
        if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
            throw new ForbiddenError('Insufficient permissions');
        }

        return prisma.comment.update({
            where: { id },
            data: { status },
        });
    }

    /**
     * Delete comment
     */
    async delete(id, userId, userRole) {
        const comment = await prisma.comment.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundError('Comment not found');
        }

        // Only comment author, moderator or admin can delete
        if (comment.userId !== userId && userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
            throw new ForbiddenError('You can only delete your own comments');
        }

        await prisma.comment.delete({ where: { id } });

        return { message: 'Comment deleted successfully' };
    }
}

module.exports = new CommentsService();
