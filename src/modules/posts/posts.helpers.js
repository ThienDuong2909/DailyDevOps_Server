const slugify = require('slugify');

const DEFAULT_LOCALE = 'vi';
const SUPPORTED_PUBLIC_LOCALES = ['vi', 'en'];

const normalizeLocale = (locale) => {
    const resolved = String(locale || DEFAULT_LOCALE).trim().toLowerCase();
    return SUPPORTED_PUBLIC_LOCALES.includes(resolved) ? resolved : DEFAULT_LOCALE;
};

const isDefaultLocale = (locale) => normalizeLocale(locale) === DEFAULT_LOCALE;

const buildListQuery = (query) => {
    const {
        page = 1,
        limit = 10,
        search,
        status,
        categoryId,
        categorySlug,
        authorId,
        tagSlug,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = query;
    const locale = normalizeLocale(query.locale);

    return {
        page,
        limit,
        locale,
        skip: (page - 1) * limit,
        where: {
            ...(search && {
                OR: isDefaultLocale(locale)
                    ? [
                        { title: { contains: search } },
                        { excerpt: { contains: search } },
                        { content: { contains: search } },
                    ]
                    : [
                        {
                            translations: {
                                some: {
                                    locale,
                                    title: { contains: search },
                                },
                            },
                        },
                        {
                            translations: {
                                some: {
                                    locale,
                                    excerpt: { contains: search },
                                },
                            },
                        },
                        {
                            translations: {
                                some: {
                                    locale,
                                    content: { contains: search },
                                },
                            },
                        },
                    ],
            }),
            ...(status && { status }),
            ...(categoryId && { categoryId }),
            ...(categorySlug && {
                category: {
                    slug: categorySlug,
                },
            }),
            ...(authorId && { authorId }),
            ...(tagSlug && {
                tags: {
                    some: { slug: tagSlug },
                },
            }),
            ...(!isDefaultLocale(locale) && {
                translations: {
                    some: {
                        locale,
                        status: 'PUBLISHED',
                    },
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

const normalizeTranslationPayload = (dto = {}) => {
    const resolvedLocale = normalizeLocale(dto.locale);
    const resolvedContent = dto.contentHtml || dto.content || '';

    return {
        ...dto,
        locale: resolvedLocale,
        subtitle: dto.subtitle ?? dto.excerpt ?? null,
        excerpt: dto.subtitle ?? dto.excerpt ?? null,
        contentHtml: resolvedContent,
        content: resolvedContent,
        contentJson: dto.contentJson ?? null,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        canonicalUrl: dto.canonicalUrl ?? null,
        ogImage: dto.ogImage ?? null,
        focusKeywords: Array.isArray(dto.focusKeywords) ? dto.focusKeywords : [],
        noIndex: Boolean(dto.noIndex),
        noFollow: Boolean(dto.noFollow),
    };
};

const buildLocaleAlternates = (post, translationMap = {}) => {
    const alternates = {
        [DEFAULT_LOCALE]: post.slug,
    };

    Object.entries(translationMap).forEach(([locale, translation]) => {
        if (translation?.slug) {
            alternates[locale] = translation.slug;
        }
    });

    return alternates;
};

const applyTranslationToPost = (post, locale = DEFAULT_LOCALE) => {
    if (!post) {
        return post;
    }

    const resolvedLocale = normalizeLocale(locale);
    const translations = Array.isArray(post.translations) ? post.translations : [];
    const translationMap = translations.reduce((acc, item) => {
        acc[item.locale] = item;
        return acc;
    }, {});
    const translation = translationMap[resolvedLocale];

    const basePost = {
        ...post,
        subtitle: post.subtitle ?? post.excerpt ?? null,
        excerpt: post.subtitle ?? post.excerpt ?? null,
        content: post.contentHtml ?? post.content ?? '',
        contentHtml: post.contentHtml ?? post.content ?? '',
        contentJson: post.contentJson ?? null,
        locale: DEFAULT_LOCALE,
        sourcePostId: post.id,
        availableLocales: Object.keys(buildLocaleAlternates(post, translationMap)),
        localeAlternates: buildLocaleAlternates(post, translationMap),
    };

    if (isDefaultLocale(resolvedLocale) || !translation) {
        return basePost;
    }

    return {
        ...basePost,
        locale: resolvedLocale,
        title: translation.title,
        slug: translation.slug,
        subtitle: translation.subtitle ?? translation.excerpt ?? null,
        excerpt: translation.subtitle ?? translation.excerpt ?? null,
        content: translation.contentHtml ?? translation.content ?? '',
        contentHtml: translation.contentHtml ?? translation.content ?? '',
        contentJson: translation.contentJson ?? null,
        featuredImage: translation.featuredImage ?? basePost.featuredImage ?? null,
        publishedAt: translation.publishedAt ?? basePost.publishedAt,
        scheduledAt: translation.scheduledAt ?? basePost.scheduledAt,
        translationId: translation.id,
        translationStatus: translation.status,
        seoSetting: {
            ...(basePost.seoSetting ?? undefined),
            ...(translation.metaTitle && { metaTitle: translation.metaTitle }),
            ...(translation.metaDescription && { metaDescription: translation.metaDescription }),
            ...(translation.canonicalUrl && { canonicalUrl: translation.canonicalUrl }),
            ...(translation.ogImage && { ogImage: translation.ogImage }),
            noIndex: translation.noIndex,
            noFollow: translation.noFollow,
            focusKeywords: Array.isArray(translation.focusKeywords)
                ? translation.focusKeywords
                : basePost.seoSetting?.focusKeywords || [],
        },
    };
};

const serializePost = (post) => {
    if (!post) {
        return post;
    }

    return applyTranslationToPost(post, post.locale || DEFAULT_LOCALE);
};

const serializePosts = (posts = [], locale = DEFAULT_LOCALE) =>
    posts.map((post) => applyTranslationToPost(post, locale));

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
    DEFAULT_LOCALE,
    SUPPORTED_PUBLIC_LOCALES,
    normalizeLocale,
    isDefaultLocale,
    normalizeEditorPayload,
    normalizeTranslationPayload,
    applyTranslationToPost,
    serializePost,
    serializePosts,
    serializeVersion,
    serializeVersions,
};
