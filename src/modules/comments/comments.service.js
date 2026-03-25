const { NotFoundError } = require('../../middlewares/error.middleware');
const commentsRepository = require('./comments.repository');
const {
    buildAdminCommentsListQuery,
    buildCreateCommentData,
    buildPaginatedCommentsResponse,
    buildPublicCommentsQuery,
    ensureDeletePermission,
    ensureModeratorPermission,
} = require('./comments.helpers');
const {
    adminCommentInclude,
    createCommentInclude,
    publicCommentInclude,
} = require('./comments.queries');

class CommentsService {
    async getStats() {
        const [total, statusStats] = await Promise.all([
            commentsRepository.count(),
            commentsRepository.groupBy({
                by: ['status'],
                _count: true,
            }),
        ]);

        return {
            total,
            byStatus: statusStats.reduce((acc, current) => {
                acc[current.status] = current._count;
                return acc;
            }, {}),
        };
    }

    async findAll(query = {}) {
        const { page, limit, skip, where } = buildAdminCommentsListQuery(query);

        const [comments, total] = await Promise.all([
            commentsRepository.findMany({
                where,
                skip,
                take: limit,
                include: adminCommentInclude,
                orderBy: { createdAt: 'desc' },
            }),
            commentsRepository.count({ where }),
        ]);

        return buildPaginatedCommentsResponse({
            data: comments,
            total,
            page,
            limit,
        });
    }

    /**
     * Find comments by post ID
     */
    async findByPostId(postId) {
        const query = buildPublicCommentsQuery(postId);

        return commentsRepository.findMany({
            ...query,
            include: publicCommentInclude,
        });
    }

    /**
     * Create comment
     */
    async create(dto, userId, req) {
        return commentsRepository.create({
            data: buildCreateCommentData(dto, userId, req.ip),
            include: createCommentInclude,
        });
    }

    /**
     * Update comment status (approve, spam, trash)
     */
    async updateStatus(id, status, userId, userRole) {
        const comment = await commentsRepository.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundError('Comment not found');
        }

        ensureModeratorPermission(userRole);

        return commentsRepository.update({
            where: { id },
            data: { status },
        });
    }

    /**
     * Delete comment
     */
    async delete(id, userId, userRole) {
        const comment = await commentsRepository.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundError('Comment not found');
        }

        ensureDeletePermission(comment, userId, userRole);

        await commentsRepository.delete({ where: { id } });

        return { message: 'Comment deleted successfully' };
    }
}

module.exports = new CommentsService();
