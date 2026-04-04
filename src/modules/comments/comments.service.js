const { BadRequestError, NotFoundError } = require('../../middlewares/error.middleware');
const commentsRepository = require('./comments.repository');
const {
    buildAdminCommentsListQuery,
    buildAuthorCommentsListQuery,
    buildCreateCommentData,
    buildPaginatedCommentsResponse,
    buildPublicCommentsQuery,
    detectCommentModeration,
    ensureDeletePermission,
    ensureCommentReplyDepth,
    ensureGuestIdentity,
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

    async findForAuthor(authorId, query = {}) {
        const { page, limit, skip, where } = buildAuthorCommentsListQuery(authorId, query);

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
        ensureGuestIdentity({
            userId,
            authorName: dto.authorName,
            authorEmail: dto.authorEmail,
        });

        if (dto.parentId) {
            const parentComment = await commentsRepository.findUnique({
                where: { id: dto.parentId },
            });

            ensureCommentReplyDepth(parentComment);

            if (parentComment.postId !== dto.postId) {
                throw new BadRequestError('Reply comment must belong to the same post');
            }
        }

        const authorIp = req.ip;
        const recentCommentsCount = await commentsRepository.count({
            where: {
                authorIp,
                createdAt: {
                    gte: new Date(Date.now() - 60 * 1000),
                },
            },
        });

        if (recentCommentsCount >= 5) {
            throw new BadRequestError('Comment rate limit exceeded. Please wait a minute and try again.');
        }

        const moderation = detectCommentModeration({
            content: dto.content,
            isAuthenticated: Boolean(userId),
        });

        return commentsRepository.create({
            data: buildCreateCommentData(dto, userId, authorIp, moderation),
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
