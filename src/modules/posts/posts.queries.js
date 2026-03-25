const listPostInclude = {
    author: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
        },
    },
    category: {
        select: {
            id: true,
            name: true,
            slug: true,
            color: true,
        },
    },
    tags: {
        select: {
            id: true,
            name: true,
            slug: true,
        },
    },
    _count: {
        select: { comments: true },
    },
};

const detailPostInclude = {
    author: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
        },
    },
    category: true,
    tags: true,
    seoSetting: true,
    _count: {
        select: { comments: true },
    },
};

const publicPostInclude = {
    author: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
        },
    },
    category: true,
    tags: true,
    seoSetting: true,
    comments: {
        where: { status: 'APPROVED', parentId: null },
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
            },
        },
        orderBy: { createdAt: 'desc' },
    },
};

const adminWriteInclude = {
    author: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
        },
    },
    category: true,
    tags: true,
};

const statsRecentPostsSelect = {
    id: true,
    title: true,
    slug: true,
    status: true,
    viewCount: true,
    createdAt: true,
    author: {
        select: { firstName: true, lastName: true },
    },
};

const relatedPostsInclude = {
    author: {
        select: { firstName: true, lastName: true, avatar: true },
    },
    category: {
        select: { name: true, slug: true, color: true },
    },
};

module.exports = {
    listPostInclude,
    detailPostInclude,
    publicPostInclude,
    adminWriteInclude,
    statsRecentPostsSelect,
    relatedPostsInclude,
};
