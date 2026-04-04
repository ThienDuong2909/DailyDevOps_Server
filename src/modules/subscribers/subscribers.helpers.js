const crypto = require('crypto');

const { BadRequestError } = require('../../middlewares/error.middleware');

const buildSubscribersListQuery = ({ page = 1, limit = 20, isActive, status }) => {
    const where = {};

    if (isActive !== undefined) {
        where.isActive = isActive === 'true';
    }

    if (status) {
        where.status = status;
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
    status: 'PENDING',
    confirmToken: crypto.randomBytes(32).toString('hex'),
    unsubscribeToken: crypto.randomBytes(32).toString('hex'),
    isActive: false,
});

const buildSubscriberReactivateData = ({ name, existing }) => ({
    status: 'PENDING',
    isActive: false,
    confirmToken: crypto.randomBytes(32).toString('hex'),
    confirmedAt: null,
    unsubscribedAt: null,
    name: name || existing.name,
});

const ensureSubscriberToken = (subscriber) => {
    if (!subscriber) {
        throw new BadRequestError('Invalid unsubscribe token');
    }
};

const ensureConfirmableSubscriber = (subscriber) => {
    if (!subscriber) {
        throw new BadRequestError('Invalid confirmation token');
    }

    if (subscriber.status === 'CONFIRMED' && subscriber.isActive) {
        throw new BadRequestError('Subscription already confirmed');
    }
};

module.exports = {
    buildSubscribersListQuery,
    buildSubscribersResponse,
    buildSubscriberCreateData,
    buildSubscriberReactivateData,
    ensureSubscriberToken,
    ensureConfirmableSubscriber,
};
