const crypto = require('crypto');

const { BadRequestError } = require('../../middlewares/error.middleware');

const buildSubscribersListQuery = ({ page = 1, limit = 20, isActive }) => {
    const where = {};

    if (isActive !== undefined) {
        where.isActive = isActive === 'true';
    }

    return {
        page: Number(page),
        limit: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
        where,
    };
};

const buildSubscribersResponse = ({ data, total, page, limit }) => ({
    data,
    meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    },
});

const buildSubscriberCreateData = ({ email, name }) => ({
    email,
    name: name || null,
    unsubscribeToken: crypto.randomBytes(32).toString('hex'),
    isActive: true,
});

const buildSubscriberReactivateData = ({ name, existing }) => ({
    isActive: true,
    unsubscribedAt: null,
    name: name || existing.name,
});

const ensureSubscriberToken = (subscriber) => {
    if (!subscriber) {
        throw new BadRequestError('Invalid unsubscribe token');
    }
};

module.exports = {
    buildSubscribersListQuery,
    buildSubscribersResponse,
    buildSubscriberCreateData,
    buildSubscriberReactivateData,
    ensureSubscriberToken,
};
