const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const subscribersService = {
    /**
     * Subscribe to newsletter
     */
    async subscribe({ email, name }) {
        // Check if already subscribed
        const existing = await prisma.subscriber.findUnique({
            where: { email },
        });

        if (existing) {
            if (existing.isActive) {
                return { message: 'Already subscribed', subscriber: existing };
            }
            // Reactivate
            const updated = await prisma.subscriber.update({
                where: { email },
                data: {
                    isActive: true,
                    unsubscribedAt: null,
                    name: name || existing.name,
                },
            });
            return { message: 'Subscription reactivated', subscriber: updated };
        }

        // Generate unsubscribe token
        const unsubscribeToken = crypto.randomBytes(32).toString('hex');

        const subscriber = await prisma.subscriber.create({
            data: {
                email,
                name: name || null,
                unsubscribeToken,
                isActive: true,
            },
        });

        return { message: 'Subscribed successfully', subscriber };
    },

    /**
     * Unsubscribe using token
     */
    async unsubscribe(token) {
        const subscriber = await prisma.subscriber.findFirst({
            where: { unsubscribeToken: token },
        });

        if (!subscriber) {
            const error = new Error('Invalid unsubscribe token');
            error.statusCode = 400;
            throw error;
        }

        await prisma.subscriber.update({
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
        const skip = (page - 1) * limit;
        const where = {};
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const [subscribers, total] = await Promise.all([
            prisma.subscriber.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { subscribedAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    isActive: true,
                    subscribedAt: true,
                    unsubscribedAt: true,
                },
            }),
            prisma.subscriber.count({ where }),
        ]);

        return {
            data: subscribers,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    },

    /**
     * Get subscriber stats
     */
    async getStats() {
        const [total, active, inactive] = await Promise.all([
            prisma.subscriber.count(),
            prisma.subscriber.count({ where: { isActive: true } }),
            prisma.subscriber.count({ where: { isActive: false } }),
        ]);

        return { total, active, inactive };
    },

    /**
     * Delete subscriber (admin)
     */
    async delete(id) {
        return prisma.subscriber.delete({ where: { id } });
    },
};

module.exports = subscribersService;
