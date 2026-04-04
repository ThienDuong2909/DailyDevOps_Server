const userListSelect = {
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
};

const userDetailSelect = {
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
};

const userWriteSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatar: true,
    bio: true,
    role: true,
    isActive: true,
};

const publicAuthorSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatar: true,
    bio: true,
    role: true,
    isActive: true,
    createdAt: true,
    posts: {
        where: {
            status: 'PUBLISHED',
        },
        select: {
            id: true,
            title: true,
            slug: true,
            subtitle: true,
            excerpt: true,
            content: true,
            contentHtml: true,
            contentJson: true,
            featuredImage: true,
            status: true,
            viewCount: true,
            readingTime: true,
            publishedAt: true,
            scheduledAt: true,
            createdAt: true,
            updatedAt: true,
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
                select: {
                    comments: true,
                },
            },
        },
        orderBy: {
            publishedAt: 'desc',
        },
    },
};

module.exports = {
    userListSelect,
    userDetailSelect,
    userWriteSelect,
    publicAuthorSelect,
};
