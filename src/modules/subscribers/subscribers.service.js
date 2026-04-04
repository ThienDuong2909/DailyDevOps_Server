const subscribersRepository = require('./subscribers.repository');
const {
    buildSubscriberCreateData,
    buildSubscriberReactivateData,
    buildSubscribersListQuery,
    buildSubscribersResponse,
    ensureConfirmableSubscriber,
    ensureSubscriberToken,
} = require('./subscribers.helpers');
const { subscriberListSelect } = require('./subscribers.queries');
const { sendSubscriptionConfirmationEmail, sendPostPublishedEmail } = require('./subscribers.mailer');

const subscribersService = {
    async dispatchConfirmationEmail(subscriber) {
        if (!subscriber?.confirmToken) {
            return { skipped: true };
        }

        return sendSubscriptionConfirmationEmail({
            email: subscriber.email,
            name: subscriber.name,
            confirmationToken: subscriber.confirmToken,
        });
    },

    async dispatchPublishedPostNewsletter(post) {
        const subscribers = await subscribersRepository.findMany({
            where: {
                status: 'CONFIRMED',
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                unsubscribeToken: true,
            },
        });

        if (subscribers.length === 0) {
            return { sentCount: 0, skipped: true };
        }

        let sentCount = 0;

        for (const subscriber of subscribers) {
            if (!subscriber.unsubscribeToken) {
                continue;
            }

            await sendPostPublishedEmail({ subscriber, post });
            sentCount += 1;
        }

        return { sentCount, skipped: false };
    },

    /**
     * Subscribe to newsletter
     */
    async subscribe({ email, name }) {
        const existing = await subscribersRepository.findUnique({
            where: { email },
        });

        if (existing) {
            if (existing.status === 'CONFIRMED' && existing.isActive) {
                return {
                    message: 'Already subscribed. You are already confirmed.',
                    subscriber: existing,
                    confirmationToken: null,
                };
            }

            if (existing.status === 'PENDING') {
                const updated = await subscribersRepository.update({
                    where: { email },
                    data: buildSubscriberReactivateData({ name, existing }),
                });
                const mailResult = await this.dispatchConfirmationEmail(updated);

                return {
                    message: mailResult?.skipped
                        ? 'Subscription pending. Use the confirmation link below.'
                        : 'Subscription pending. Check your inbox to confirm.',
                    subscriber: updated,
                    confirmationToken: mailResult?.skipped ? updated.confirmToken : null,
                };
            }

            const updated = await subscribersRepository.update({
                where: { email },
                data: buildSubscriberReactivateData({ name, existing }),
            });
            const mailResult = await this.dispatchConfirmationEmail(updated);

            return {
                message: mailResult?.skipped
                    ? 'Subscription restarted. Use the confirmation link below.'
                    : 'Subscription restarted. Check your inbox to confirm.',
                subscriber: updated,
                confirmationToken: mailResult?.skipped ? updated.confirmToken : null,
            };
        }

        const subscriber = await subscribersRepository.create({
            data: buildSubscriberCreateData({ email, name }),
        });

        const mailResult = await this.dispatchConfirmationEmail(subscriber);

        return {
            message: mailResult?.skipped
                ? 'Subscription created. Use the confirmation link below.'
                : 'Subscription created. Check your inbox to confirm.',
            subscriber,
            confirmationToken: mailResult?.skipped ? subscriber.confirmToken : null,
        };
    },

    async confirm(token) {
        const subscriber = await subscribersRepository.findFirst({
            where: { confirmToken: token },
        });

        ensureConfirmableSubscriber(subscriber);

        const updated = await subscribersRepository.update({
            where: { id: subscriber.id },
            data: {
                status: 'CONFIRMED',
                isActive: true,
                confirmedAt: new Date(),
                confirmToken: null,
                unsubscribedAt: null,
            },
        });

        return {
            message: 'Subscription confirmed successfully',
            subscriber: updated,
        };
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
                status: 'UNSUBSCRIBED',
                isActive: false,
                unsubscribedAt: new Date(),
            },
        });

        return { message: 'Unsubscribed successfully' };
    },

    /**
     * Get all subscribers (admin)
     */
    async findAll({ page = 1, limit = 20, isActive, status }) {
        const { page: resolvedPage, limit: resolvedLimit, skip, where } = buildSubscribersListQuery({
            page,
            limit,
            isActive,
            status,
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
        const [total, active, inactive, pending, confirmed] = await Promise.all([
            subscribersRepository.count(),
            subscribersRepository.count({ where: { isActive: true } }),
            subscribersRepository.count({ where: { isActive: false } }),
            subscribersRepository.count({ where: { status: 'PENDING' } }),
            subscribersRepository.count({ where: { status: 'CONFIRMED' } }),
        ]);

        return { total, active, inactive, pending, confirmed };
    },

    /**
     * Delete subscriber (admin)
     */
    async delete(id) {
        return subscribersRepository.delete({ where: { id } });
    },
};

module.exports = subscribersService;
