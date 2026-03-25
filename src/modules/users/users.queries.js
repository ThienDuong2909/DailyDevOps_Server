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

module.exports = {
    userListSelect,
    userDetailSelect,
    userWriteSelect,
};
