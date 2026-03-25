const { ForbiddenError } = require('../../middlewares/error.middleware');

const buildPublicCommentsQuery = (postId) => ({
    where: {
        postId,
        status: 'APPROVED',
        parentId: null,
    },
    orderBy: { createdAt: 'desc' },
});

const buildCreateCommentData = (dto, userId, ipAddress) => ({
    content: dto.content,
    postId: dto.postId,
    userId: userId || null,
    parentId: dto.parentId || null,
    authorName: dto.authorName || null,
    authorEmail: dto.authorEmail || null,
    authorIp: ipAddress,
    status: 'PENDING',
});

const buildAdminCommentsListQuery = (query = {}) => {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const status = query.status && query.status !== 'all' ? query.status : undefined;
    const search = query.search ? query.search.trim() : '';

    const where = {
        ...(status && { status }),
        ...(search && {
            OR: [
                { content: { contains: search } },
                { authorName: { contains: search } },
                { authorEmail: { contains: search } },
                { post: { title: { contains: search } } },
                {
                    user: {
                        OR: [
                            { firstName: { contains: search } },
                            { lastName: { contains: search } },
                            { email: { contains: search } },
                        ],
                    },
                },
            ],
        }),
    };

    return {
        page,
        limit,
        skip: (page - 1) * limit,
        where,
    };
};

const buildPaginatedCommentsResponse = ({ data, total, page, limit }) => ({
    data,
    meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    },
});

const ensureModeratorPermission = (userRole) => {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
        throw new ForbiddenError('Insufficient permissions');
    }
};

const ensureDeletePermission = (comment, userId, userRole) => {
    if (comment.userId !== userId && userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
        throw new ForbiddenError('You can only delete your own comments');
    }
};

module.exports = {
    buildPublicCommentsQuery,
    buildCreateCommentData,
    buildAdminCommentsListQuery,
    buildPaginatedCommentsResponse,
    ensureModeratorPermission,
    ensureDeletePermission,
};
