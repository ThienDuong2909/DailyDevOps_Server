const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

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

function getWindowStart(days) {
    const value = Number(days) || 30;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() - value);
    return nextDate;
}

class ComplianceService {
    async getOverview({ days = 30 }) {
        const since = getWindowStart(days);
        const events = await prisma.activityLog.findMany({
            where: {
                OR: [
                    {
                        entity: 'Consent',
                    },
                    {
                        entity: 'Privacy',
                    },
                ],
                createdAt: {
                    gte: since,
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 120,
        });

        const consentEvents = events.filter((event) => event.entity === 'Consent');
        const privacyEvents = events.filter((event) => event.entity === 'Privacy');
        const acceptanceCount = consentEvents.filter((event) => {
            const details = safeParseDetails(event.details);
            return details.status === 'accepted' || details.status === 'customized';
        }).length;
        const essentialOnlyCount = consentEvents.filter((event) => {
            const details = safeParseDetails(event.details);
            return details.status === 'essential-only';
        }).length;
        const deletionRequests = privacyEvents.filter(
            (event) => event.action === 'ACCOUNT_DELETION_REQUEST'
        );
        const exportRequests = privacyEvents.filter(
            (event) => event.action === 'DATA_EXPORT_REQUEST'
        );

        return {
            rangeDays: days,
            overview: {
                consentUpdates: consentEvents.length,
                analyticsOptIns: acceptanceCount,
                essentialOnlyCount,
                deletionRequests: deletionRequests.length,
                dataExportRequests: exportRequests.length,
            },
            recentEvents: events.slice(0, 20).map((event) => ({
                id: event.id,
                action: event.action,
                entity: event.entity,
                userEmail: event.userEmail,
                createdAt: event.createdAt,
                details: safeParseDetails(event.details),
            })),
        };
    }
}

module.exports = new ComplianceService();
