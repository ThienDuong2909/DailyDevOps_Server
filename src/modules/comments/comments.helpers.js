const { BadRequestError, ForbiddenError } = require('../../middlewares/error.middleware');

const buildPublicCommentsQuery = (postId) => ({
    where: {
        postId,
        status: 'APPROVED',
        parentId: null,
    },
    orderBy: { createdAt: 'desc' },
});

const SPAM_KEYWORDS = [
    'viagra',
    'casino',
    'crypto giveaway',
    'telegram',
    'whatsapp',
    'seo service',
    'backlink',
    'loan approval',
    'betting',
];

const PROFANITY_KEYWORDS = ['địt', 'dit me', 'ngu vl', 'fuck you', 'bitch', 'shit'];

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const countUrls = (value) => {
    const matches = String(value || '').match(/https?:\/\/|www\./gi);
    return matches ? matches.length : 0;
};

const detectCommentModeration = ({ content, isAuthenticated }) => {
    const normalized = normalizeText(content);
    const reasons = [];

    if (!isAuthenticated) {
        reasons.push('guest_comment');
    }

    if (countUrls(content) >= 2) {
        reasons.push('too_many_links');
    }

    if (SPAM_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
        reasons.push('spam_keyword');
    }

    if (PROFANITY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
        reasons.push('profanity');
    }

    if (/(.)\1{7,}/.test(normalized)) {
        reasons.push('repeated_characters');
    }

    const status = reasons.some((reason) => ['too_many_links', 'spam_keyword'].includes(reason))
        ? 'SPAM'
        : 'PENDING';

    return {
        status,
        reasons,
    };
};

const buildCreateCommentData = (dto, userId, ipAddress, moderation) => ({
    content: dto.content,
    postId: dto.postId,
    userId: userId || null,
    parentId: dto.parentId || null,
    authorName: dto.authorName || null,
    authorEmail: dto.authorEmail || null,
    authorIp: ipAddress,
    status: moderation.status,
});

const buildAdminCommentsListQuery = (query = {}) => {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const status = query.status && query.status !== 'all' ? query.status : undefined;
    const search = query.search ? query.search.trim() : '';

    const where = {
        ...(status && { status }),
        ...(search && {
            OR: [
                { content: { contains: search } },
                { authorName: { contains: search } },
                { authorEmail: { contains: search } },
                { post: { title: { contains: search } } },
                {
                    user: {
                        OR: [
                            { firstName: { contains: search } },
                            { lastName: { contains: search } },
                            { email: { contains: search } },
                        ],
                    },
                },
            ],
        }),
    };

    return {
        page,
        limit,
        skip: (page - 1) * limit,
        where,
    };
};

const buildAuthorCommentsListQuery = (authorId, query = {}) => {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const status = query.status && query.status !== 'all' ? query.status : undefined;
    const search = query.search ? query.search.trim() : '';

    const where = {
        post: {
            authorId,
        },
        ...(status && { status }),
        ...(search && {
            OR: [
                { content: { contains: search } },
                { authorName: { contains: search } },
                { authorEmail: { contains: search } },
                { post: { title: { contains: search } } },
                {
                    user: {
                        OR: [
                            { firstName: { contains: search } },
                            { lastName: { contains: search } },
                            { email: { contains: search } },
                        ],
                    },
                },
            ],
        }),
    };

    return {
        page,
        limit,
        skip: (page - 1) * limit,
        where,
    };
};

const buildPaginatedCommentsResponse = ({ data, total, page, limit }) => ({
    data,
    meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    },
});

const ensureModeratorPermission = (userRole) => {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
        throw new ForbiddenError('Insufficient permissions');
    }
};

const ensureDeletePermission = (comment, userId, userRole) => {
    if (comment.userId !== userId && userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
        throw new ForbiddenError('You can only delete your own comments');
    }
};

const ensureGuestIdentity = ({ userId, authorName, authorEmail }) => {
    if (userId) {
        return;
    }

    if (!authorName || !authorEmail) {
        throw new BadRequestError('Guest comments require name and email');
    }
};

const ensureCommentReplyDepth = (parentComment) => {
    if (!parentComment) {
        throw new BadRequestError('Parent comment not found');
    }

    if (parentComment.parentId) {
        throw new BadRequestError('Replies are limited to 2 levels');
    }
};

module.exports = {
    buildPublicCommentsQuery,
    buildCreateCommentData,
    buildAdminCommentsListQuery,
    buildAuthorCommentsListQuery,
    buildPaginatedCommentsResponse,
    detectCommentModeration,
    ensureModeratorPermission,
    ensureDeletePermission,
    ensureGuestIdentity,
    ensureCommentReplyDepth,
};
