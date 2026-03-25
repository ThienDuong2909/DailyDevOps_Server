const slugify = require('slugify');

const buildListQuery = (query) => {
    const {
        page = 1,
        limit = 10,
        search,
        status,
        categoryId,
        authorId,
        tagSlug,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = query;

    return {
        page,
        limit,
        skip: (page - 1) * limit,
        where: {
            ...(search && {
                OR: [
                    { title: { contains: search } },
                    { excerpt: { contains: search } },
                    { content: { contains: search } },
                ],
            }),
            ...(status && { status }),
            ...(categoryId && { categoryId }),
            ...(authorId && { authorId }),
            ...(tagSlug && {
                tags: {
                    some: { slug: tagSlug },
                },
            }),
        },
        orderBy: { [sortBy]: sortOrder },
    };
};

const buildPaginatedResponse = ({ data, total, page, limit }) => ({
    data,
    meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    },
});

const buildReadingTime = (content) => {
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / 200);
};

const buildPublishedAt = (status, existingPublishedAt = null) => {
    if (status === 'PUBLISHED' && !existingPublishedAt) {
        return new Date();
    }

    return existingPublishedAt;
};

const generateSlug = (title) =>
    slugify(title, {
        lower: true,
        strict: true,
        locale: 'en',
    });

const buildTagConnect = (tagIds = []) => {
    if (!tagIds.length) {
        return undefined;
    }

    return { connect: tagIds.map((id) => ({ id })) };
};

const buildTagReplace = (tagIds) => {
    if (!tagIds) {
        return undefined;
    }

    return {
        set: [],
        connect: tagIds.map((tagId) => ({ id: tagId })),
    };
};

module.exports = {
    buildListQuery,
    buildPaginatedResponse,
    buildReadingTime,
    buildPublishedAt,
    buildTagConnect,
    buildTagReplace,
    generateSlug,
};
