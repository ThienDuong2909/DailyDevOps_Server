const commentUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    avatar: true,
};

const publicRepliesInclude = {
    where: { status: 'APPROVED' },
    include: {
        user: {
            select: commentUserSelect,
        },
    },
    orderBy: { createdAt: 'asc' },
};

const publicCommentInclude = {
    user: {
        select: commentUserSelect,
    },
    replies: publicRepliesInclude,
};

const createCommentInclude = {
    user: {
        select: commentUserSelect,
    },
};

const adminCommentInclude = {
    user: {
        select: {
            ...commentUserSelect,
            email: true,
        },
    },
    post: {
        select: {
            id: true,
            title: true,
            slug: true,
        },
    },
};

module.exports = {
    commentUserSelect,
    publicCommentInclude,
    createCommentInclude,
    adminCommentInclude,
};
