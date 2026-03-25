const tagListInclude = {
    _count: {
        select: { posts: true },
    },
};

const tagDetailInclude = {
    _count: {
        select: { posts: true },
    },
};

module.exports = {
    tagListInclude,
    tagDetailInclude,
};
