const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

function getWindowStart(days) {
    const value = Number(days) || 30;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() - value);
    return nextDate;
}

function safeParseDetails(details) {
    if (!details) {
        return {};
    }

    try {
        return JSON.parse(details);
    } catch {
        return {};
    }
}

function buildTrend(current, previous) {
    if (!previous) {
        return current > 0 ? '+100%' : '0%';
    }

    const diff = ((current - previous) / previous) * 100;
    const prefix = diff >= 0 ? '+' : '';
    return `${prefix}${diff.toFixed(1)}%`;
}

function createEmptyOverview(days) {
    return {
        rangeDays: days,
        overview: {
            pageViews: { total: 0, change: '0%' },
            searches: { total: 0, change: '0%' },
            newsletterSubscriptions: { total: 0, change: '0%' },
            commentSubmissions: { total: 0, change: '0%' },
        },
        topPages: [],
        topSearches: [],
        recentEvents: [],
    };
}

class AnalyticsService {
    async trackEvent({ eventType, payload, req }) {
        const details = {
            ...payload,
            referer: req.get('referer') || null,
            timestamp: new Date().toISOString(),
        };

        await prisma.activityLog.create({
            data: {
                action: eventType,
                entity: 'Analytics',
                userId: req.user?.id || null,
                userEmail: req.user?.email || null,
                ipAddress: req.ip,
                userAgent: req.get('user-agent') || null,
                details: JSON.stringify(details),
            },
        });

        return { tracked: true };
    }

    async getOverview({ days = 30 }) {
        const since = getWindowStart(days);
        const previousSince = getWindowStart(days * 2);

        const [currentEvents, previousEvents] = await Promise.all([
            prisma.activityLog.findMany({
                where: {
                    entity: 'Analytics',
                    createdAt: { gte: since },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.activityLog.findMany({
                where: {
                    entity: 'Analytics',
                    createdAt: {
                        gte: previousSince,
                        lt: since,
                    },
                },
            }),
        ]);

        if (!currentEvents.length && !previousEvents.length) {
            return createEmptyOverview(days);
        }

        const countByAction = (events, action) =>
            events.filter((event) => event.action === action).length;

        const topPagesMap = new Map();
        const topSearchesMap = new Map();

        for (const event of currentEvents) {
            const details = safeParseDetails(event.details);

            if (event.action === 'PAGE_VIEW' && details.path) {
                topPagesMap.set(details.path, (topPagesMap.get(details.path) || 0) + 1);
            }

            if (event.action === 'SEARCH' && details.searchTerm) {
                const current = topSearchesMap.get(details.searchTerm) || {
                    term: details.searchTerm,
                    searches: 0,
                    totalResults: 0,
                };
                current.searches += 1;
                current.totalResults += Number(details.resultsCount) || 0;
                topSearchesMap.set(details.searchTerm, current);
            }
        }

        return {
            rangeDays: days,
            overview: {
                pageViews: {
                    total: countByAction(currentEvents, 'PAGE_VIEW'),
                    change: buildTrend(
                        countByAction(currentEvents, 'PAGE_VIEW'),
                        countByAction(previousEvents, 'PAGE_VIEW')
                    ),
                },
                searches: {
                    total: countByAction(currentEvents, 'SEARCH'),
                    change: buildTrend(
                        countByAction(currentEvents, 'SEARCH'),
                        countByAction(previousEvents, 'SEARCH')
                    ),
                },
                newsletterSubscriptions: {
                    total: countByAction(currentEvents, 'NEWSLETTER_SUBSCRIBE'),
                    change: buildTrend(
                        countByAction(currentEvents, 'NEWSLETTER_SUBSCRIBE'),
                        countByAction(previousEvents, 'NEWSLETTER_SUBSCRIBE')
                    ),
                },
                commentSubmissions: {
                    total: countByAction(currentEvents, 'COMMENT_SUBMIT'),
                    change: buildTrend(
                        countByAction(currentEvents, 'COMMENT_SUBMIT'),
                        countByAction(previousEvents, 'COMMENT_SUBMIT')
                    ),
                },
            },
            topPages: Array.from(topPagesMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([path, views]) => ({ path, views })),
            topSearches: Array.from(topSearchesMap.values())
                .sort((a, b) => b.searches - a.searches)
                .slice(0, 8)
                .map((item) => ({
                    term: item.term,
                    searches: item.searches,
                    averageResults: item.searches
                        ? Math.round(item.totalResults / item.searches)
                        : 0,
                })),
            recentEvents: currentEvents.slice(0, 12).map((event) => ({
                id: event.id,
                action: event.action,
                createdAt: event.createdAt,
                details: safeParseDetails(event.details),
            })),
        };
    }
}

module.exports = new AnalyticsService();
