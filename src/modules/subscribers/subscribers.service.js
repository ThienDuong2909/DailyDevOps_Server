const subscribersRepository = require('./subscribers.repository');
const {
    buildSubscriberCreateData,
    buildSubscriberReactivateData,
    buildSubscribersListQuery,
    buildSubscribersResponse,
    ensureSubscriberToken,
} = require('./subscribers.helpers');
const { subscriberListSelect } = require('./subscribers.queries');

const subscribersService = {
    /**
     * Subscribe to newsletter
     */
    async subscribe({ email, name }) {
        const existing = await subscribersRepository.findUnique({
            where: { email },
        });

        if (existing) {
            if (existing.isActive) {
                return { message: 'Already subscribed', subscriber: existing };
            }
            // Reactivate
            const updated = await subscribersRepository.update({
                where: { email },
                data: buildSubscriberReactivateData({ name, existing }),
            });
            return { message: 'Subscription reactivated', subscriber: updated };
        }

        const subscriber = await subscribersRepository.create({
            data: buildSubscriberCreateData({ email, name }),
        });

        return { message: 'Subscribed successfully', subscriber };
    },

    /**
     * Unsubscribe using token
     */
    async unsubscribe(token) {
        const subscriber = await subscribersRepository.findFirst({
            where: { unsubscribeToken: token },
        });
        ensureSubscriberToken(subscriber);

        await subscribersRepository.update({
            where: { id: subscriber.id },
            data: {
                isActive: false,
                unsubscribedAt: new Date(),
            },
        });

        return { message: 'Unsubscribed successfully' };
    },

    /**
     * Get all subscribers (admin)
     */
    async findAll({ page = 1, limit = 20, isActive }) {
        const { page: resolvedPage, limit: resolvedLimit, skip, where } = buildSubscribersListQuery({
            page,
            limit,
            isActive,
        });

        const [subscribers, total] = await Promise.all([
            subscribersRepository.findMany({
                where,
                skip,
                take: resolvedLimit,
                orderBy: { subscribedAt: 'desc' },
                select: subscriberListSelect,
            }),
            subscribersRepository.count({ where }),
        ]);

        return buildSubscribersResponse({
            data: subscribers,
            total,
            page: resolvedPage,
            limit: resolvedLimit,
        });
    },

    /**
     * Get subscriber stats
     */
    async getStats() {
        const [total, active, inactive] = await Promise.all([
            subscribersRepository.count(),
            subscribersRepository.count({ where: { isActive: true } }),
            subscribersRepository.count({ where: { isActive: false } }),
        ]);

        return { total, active, inactive };
    },

    /**
     * Delete subscriber (admin)
     */
    async delete(id) {
        return subscribersRepository.delete({ where: { id } });
    },
};

module.exports = subscribersService;
