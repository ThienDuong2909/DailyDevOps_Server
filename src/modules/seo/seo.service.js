const seoRepository = require('./seo.repository');
const {
    DEFAULT_PAGE,
    SYSTEM_SETTINGS_MAP,
    buildPublicSeoConfig,
    buildSeoResponse,
    stringifySystemValue,
} = require('./seo.helpers');

class SeoService {
    async getPublicConfig() {
        const systemSettings = await seoRepository.findSystemSettings({
            where: {
                key: {
                    in: [
                        SYSTEM_SETTINGS_MAP.analyticsId.key,
                        SYSTEM_SETTINGS_MAP.searchIndexing.key,
                    ],
                },
            },
        });

        return buildPublicSeoConfig(systemSettings);
    }

    async getDashboard() {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blog.thienduong.info';

        const [homepageRecord, systemSettings, posts] = await Promise.all([
            seoRepository.findGlobalSettings({
                where: { pageType: 'home' },
                take: 1,
            }).then((records) => records[0] || null),
            seoRepository.findSystemSettings({
                where: {
                    key: {
                        in: Object.values(SYSTEM_SETTINGS_MAP).map((item) => item.key),
                    },
                },
            }),
            seoRepository.findPublishedPosts({
                where: { status: 'PUBLISHED' },
                orderBy: { publishedAt: 'desc' },
                take: 8,
                include: {
                    tags: { select: { name: true } },
                    seoSetting: true,
                },
            }),
        ]);

        return buildSeoResponse({
            homepageRecord: homepageRecord || DEFAULT_PAGE,
            posts,
            systemSettings,
            baseUrl,
        });
    }

    async updateDashboard(payload) {
        const existingHomepageSetting = await seoRepository.findGlobalSettings({
            where: { pageType: 'home' },
            take: 1,
        }).then((records) => records[0] || null);

        await Promise.all(
            Object.entries(SYSTEM_SETTINGS_MAP).map(([fieldName, config]) =>
                seoRepository.upsertSystemSetting({
                    where: { key: config.key },
                    update: {
                        value: stringifySystemValue(payload.globalSettings[fieldName], config.type),
                        type: config.type,
                        group: config.group,
                    },
                    create: {
                        key: config.key,
                        value: stringifySystemValue(payload.globalSettings[fieldName], config.type),
                        type: config.type,
                        group: config.group,
                    },
                })
            )
        );

        if (existingHomepageSetting) {
            await seoRepository.upsertSeoSetting({
                where: { id: existingHomepageSetting.id },
                update: {
                    metaTitle: payload.homepage.metaTitle,
                    metaDescription: payload.homepage.metaDescription,
                    canonicalUrl: payload.homepage.canonicalUrl || null,
                    focusKeywords: payload.homepage.focusKeywords || [],
                    ogImage: payload.homepage.ogImage || null,
                    noIndex: payload.homepage.noIndex,
                    noFollow: payload.homepage.noFollow,
                    pageType: 'home',
                },
                create: {
                    id: existingHomepageSetting.id,
                    pageType: 'home',
                    metaTitle: payload.homepage.metaTitle,
                    metaDescription: payload.homepage.metaDescription,
                    canonicalUrl: payload.homepage.canonicalUrl || null,
                    focusKeywords: payload.homepage.focusKeywords || [],
                    ogImage: payload.homepage.ogImage || null,
                    noIndex: payload.homepage.noIndex,
                    noFollow: payload.homepage.noFollow,
                },
            });
        } else {
            await seoRepository.upsertSeoSetting({
                where: { id: 'home-page-seo' },
                update: {
                    metaTitle: payload.homepage.metaTitle,
                    metaDescription: payload.homepage.metaDescription,
                    canonicalUrl: payload.homepage.canonicalUrl || null,
                    focusKeywords: payload.homepage.focusKeywords || [],
                    ogImage: payload.homepage.ogImage || null,
                    noIndex: payload.homepage.noIndex,
                    noFollow: payload.homepage.noFollow,
                    pageType: 'home',
                },
                create: {
                    id: 'home-page-seo',
                    pageType: 'home',
                    metaTitle: payload.homepage.metaTitle,
                    metaDescription: payload.homepage.metaDescription,
                    canonicalUrl: payload.homepage.canonicalUrl || null,
                    focusKeywords: payload.homepage.focusKeywords || [],
                    ogImage: payload.homepage.ogImage || null,
                    noIndex: payload.homepage.noIndex,
                    noFollow: payload.homepage.noFollow,
                },
            });
        }

        return this.getDashboard();
    }
}

module.exports = new SeoService();
