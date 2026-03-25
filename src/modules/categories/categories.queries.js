const categoryListInclude = {
    _count: {
        select: { posts: true },
    },
    parent: {
        select: { id: true, name: true, slug: true },
    },
};

const categoryDetailInclude = {
    _count: { select: { posts: true } },
    parent: true,
    children: true,
};

const categorySlugInclude = {
    _count: { select: { posts: true } },
};

module.exports = {
    categoryListInclude,
    categoryDetailInclude,
    categorySlugInclude,
};
