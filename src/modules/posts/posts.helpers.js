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
    // Use a simple, non-backtracking approach to strip HTML tags.
    // Replace each '<' up to the next '>' with a space, character by character.
    const raw = String(content || '');
    let plainText = '';
    let inTag = false;
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '<') {
            inTag = true;
            plainText += ' ';
        } else if (raw[i] === '>') {
            inTag = false;
        } else if (!inTag) {
            plainText += raw[i];
        }
    }
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    return Math.ceil(wordCount / 200);
};

const buildPublishedAt = (status, existingPublishedAt = null) => {
    if (!status) {
        return existingPublishedAt;
    }

    if (status === 'PUBLISHED' && !existingPublishedAt) {
        return new Date();
    }

    if (status !== 'PUBLISHED') {
        return null;
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

const normalizeEditorPayload = (dto = {}) => {
    const resolvedContent = dto.contentHtml || dto.content || '';

    return {
        ...dto,
        subtitle: dto.subtitle ?? dto.excerpt ?? null,
        excerpt: dto.subtitle ?? dto.excerpt ?? null,
        rejectionReason: dto.rejectionReason ?? null,
        contentHtml: resolvedContent,
        content: resolvedContent,
        contentJson: dto.contentJson ?? null,
    };
};

const serializePost = (post) => {
    if (!post) {
        return post;
    }

    return {
        ...post,
        subtitle: post.subtitle ?? post.excerpt ?? null,
        excerpt: post.subtitle ?? post.excerpt ?? null,
        content: post.contentHtml ?? post.content ?? '',
        contentHtml: post.contentHtml ?? post.content ?? '',
        contentJson: post.contentJson ?? null,
    };
};

const serializePosts = (posts = []) => posts.map(serializePost);

const serializeVersion = (version) => {
    if (!version) {
        return version;
    }

    return {
        ...version,
        tagIds: Array.isArray(version.tagIds) ? version.tagIds : [],
    };
};

const serializeVersions = (versions = []) => versions.map(serializeVersion);

module.exports = {
    buildListQuery,
    buildPaginatedResponse,
    buildReadingTime,
    buildPublishedAt,
    buildTagConnect,
    buildTagReplace,
    generateSlug,
    normalizeEditorPayload,
    serializePost,
    serializePosts,
    serializeVersion,
    serializeVersions,
};
