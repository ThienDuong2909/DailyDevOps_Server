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
    translations: {
        select: {
            id: true,
            locale: true,
            slug: true,
            title: true,
            status: true,
            publishedAt: true,
            featuredImage: true,
            updatedAt: true,
        },
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
    translations: true,
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
    translations: true,
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
    translations: true,
};

const postVersionListSelect = {
    id: true,
    title: true,
    slug: true,
    status: true,
    reason: true,
    createdAt: true,
    createdBy: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
        },
    },
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
    translations: {
        select: {
            id: true,
            locale: true,
            slug: true,
            title: true,
            status: true,
            publishedAt: true,
            featuredImage: true,
            updatedAt: true,
        },
    },
};

module.exports = {
    listPostInclude,
    detailPostInclude,
    publicPostInclude,
    adminWriteInclude,
    postVersionListSelect,
    statsRecentPostsSelect,
    relatedPostsInclude,
};
