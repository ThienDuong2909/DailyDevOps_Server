const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class ConsentService {
    async trackConsent({ consentId, status, preferences, source, req }) {
        await prisma.activityLog.create({
            data: {
                action: 'CONSENT_UPDATE',
                entity: 'Consent',
                userId: req.user?.id || null,
                userEmail: req.user?.email || null,
                ipAddress: req.ip,
                userAgent: req.get('user-agent') || null,
                details: JSON.stringify({
                    consentId,
                    status,
                    source,
                    preferences,
                    timestamp: new Date().toISOString(),
                    referer: req.get('referer') || null,
                }),
            },
        });

        return {
            tracked: true,
        };
    }
}

module.exports = new ConsentService();
