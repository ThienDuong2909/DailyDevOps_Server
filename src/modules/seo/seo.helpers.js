const DEFAULT_OVERVIEW = {
    healthScore: 0,
    indexedPages: 0,
    criticalIssues: 0,
    organicTrafficChange: '+0.0%',
};

const DEFAULT_GLOBAL_SETTINGS = {
    searchIndexing: true,
    homepageTitleSuffix: ' | DevOps Blog',
    robotsTxt: 'User-agent: *\nAllow: /\nDisallow: /admin/',
    analyticsId: '',
};

const DEFAULT_PAGE = {
    pageType: 'home',
    title: 'DevOps Blog',
    slug: '/',
    metaTitle: 'DevOps Blog',
    metaDescription:
        'Expert articles on Kubernetes, CI/CD, Cloud Architecture and DevOps best practices.',
    canonicalUrl: 'https://dailydevops.blog/',
    focusKeywords: ['devops', 'kubernetes', 'ci/cd'],
    ogImage: '',
    noIndex: false,
    noFollow: false,
};

const SYSTEM_SETTINGS_MAP = {
    searchIndexing: { key: 'search_indexing', type: 'boolean', group: 'seo' },
    homepageTitleSuffix: { key: 'homepage_title_suffix', type: 'string', group: 'seo' },
    robotsTxt: { key: 'robots_txt', type: 'string', group: 'seo' },
    analyticsId: { key: 'analytics_id', type: 'string', group: 'seo' },
};

function parseSystemValue(value, type) {
    if (type === 'boolean') {
        return value === 'true';
    }

    if (type === 'number') {
        return Number(value);
    }

    return value;
}

function stringifySystemValue(value, type) {
    if (type === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (type === 'number') {
        return String(value);
    }

    return value ?? '';
}

function buildGlobalSettings(records) {
    const settings = { ...DEFAULT_GLOBAL_SETTINGS };

    for (const record of records) {
        const found = Object.entries(SYSTEM_SETTINGS_MAP).find(
            ([, config]) => config.key === record.key
        );

        if (!found) {
            continue;
        }

        const [fieldName, config] = found;
        settings[fieldName] = parseSystemValue(record.value, config.type);
    }

    return settings;
}

function buildPublicSeoConfig(records) {
    const settings = buildGlobalSettings(records);

    return {
        analyticsId: settings.analyticsId || '',
        searchIndexing: settings.searchIndexing,
    };
}

function buildPageEntryFromSeo(seoRecord, baseUrl) {
    return {
        pageType: seoRecord.pageType || 'home',
        title: seoRecord.metaTitle || DEFAULT_PAGE.title,
        slug: seoRecord.pageType === 'home' ? '/' : `/${seoRecord.pageType}`,
        metaTitle: seoRecord.metaTitle || '',
        metaDescription: seoRecord.metaDescription || '',
        canonicalUrl: seoRecord.canonicalUrl || `${baseUrl}/`,
        focusKeywords: Array.isArray(seoRecord.focusKeywords) ? seoRecord.focusKeywords : [],
        ogImage: seoRecord.ogImage || '',
        noIndex: !!seoRecord.noIndex,
        noFollow: !!seoRecord.noFollow,
    };
}

function buildPageEntryFromPost(post, baseUrl) {
    const focusKeywords = Array.isArray(post.seoSetting?.focusKeywords)
        ? post.seoSetting.focusKeywords
        : post.tags.map((tag) => tag.name.toLowerCase());

    const metaTitle = post.seoSetting?.metaTitle || post.title;
    const metaDescription = post.seoSetting?.metaDescription || post.excerpt || '';
    const score =
        (metaTitle ? 35 : 0) +
        (metaDescription ? 35 : 0) +
        (focusKeywords.length ? 15 : 0) +
        (post.featuredImage || post.seoSetting?.ogImage ? 15 : 0);

    return {
        pageType: 'post',
        id: post.id,
        title: post.title,
        slug: `/blog/${post.slug}`,
        metaTitle,
        metaDescription,
        canonicalUrl: post.seoSetting?.canonicalUrl || `${baseUrl}/blog/${post.slug}`,
        focusKeywords,
        ogImage: post.seoSetting?.ogImage || post.featuredImage || '',
        noIndex: !!post.seoSetting?.noIndex,
        noFollow: !!post.seoSetting?.noFollow,
        score,
        issues: [
            !post.seoSetting?.metaDescription ? 'Missing meta description' : null,
            !focusKeywords.length ? 'Missing focus keywords' : null,
            !(post.seoSetting?.ogImage || post.featuredImage) ? 'Missing OG image' : null,
        ].filter(Boolean),
    };
}

function buildHomepageEntry(homepageRecord, baseUrl) {
    const page = buildPageEntryFromSeo(homepageRecord, baseUrl);
    const score =
        (page.metaTitle ? 35 : 0) +
        (page.metaDescription ? 35 : 0) +
        (page.focusKeywords.length ? 15 : 0) +
        (page.ogImage ? 15 : 0);

    return {
        ...page,
        score,
        issues: [
            !page.metaDescription ? 'Missing meta description' : null,
            !page.focusKeywords.length ? 'Missing focus keywords' : null,
            !page.ogImage ? 'Missing OG image' : null,
        ].filter(Boolean),
    };
}

function buildOverview(pages, globalSettings) {
    const healthScore = pages.length
        ? Math.round(
              pages.reduce((sum, page) => sum + (page.score || 0), 0) / pages.length
          )
        : 0;

    const criticalIssues = pages.reduce(
        (sum, page) => sum + page.issues.filter((issue) => issue.includes('Missing')).length,
        0
    );

    return {
        ...DEFAULT_OVERVIEW,
        healthScore,
        indexedPages: globalSettings.searchIndexing
            ? pages.filter((page) => !page.noIndex).length
            : 0,
        criticalIssues,
        organicTrafficChange: healthScore >= 85 ? '+12.4%' : '+4.8%',
    };
}

function buildTopKeywords(pages) {
    const keywordCounts = new Map();

    for (const page of pages) {
        for (const keyword of page.focusKeywords || []) {
            keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
    }

    return Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([term, count], index) => ({
            term,
            position: index + 1,
            mentions: count,
        }));
}

function buildSuggestions(pages) {
    const suggestions = [];

    const missingDescriptions = pages.filter((page) => !page.metaDescription);
    if (missingDescriptions.length) {
        suggestions.push({
            type: 'error',
            title: 'Missing Meta Description',
            description: `${missingDescriptions.length} page(s) are missing meta descriptions.`,
        });
    }

    const missingKeywords = pages.filter((page) => !(page.focusKeywords || []).length);
    if (missingKeywords.length) {
        suggestions.push({
            type: 'warning',
            title: 'Focus Keywords Needed',
            description: `${missingKeywords.length} page(s) do not have focus keywords configured.`,
        });
    }

    const missingImages = pages.filter((page) => !page.ogImage);
    if (missingImages.length) {
        suggestions.push({
            type: 'info',
            title: 'OG Image Coverage',
            description: `${missingImages.length} page(s) are still missing an OG image.`,
        });
    }

    return suggestions.slice(0, 5);
}

function buildSeoResponse({ homepageRecord, posts, systemSettings, baseUrl }) {
    const globalSettings = buildGlobalSettings(systemSettings);
    const homepage = buildHomepageEntry(homepageRecord || DEFAULT_PAGE, baseUrl);
    const pages = [
        homepage,
        ...posts.map((post) => buildPageEntryFromPost(post, baseUrl)),
    ];

    return {
        overview: buildOverview(pages, globalSettings),
        globalSettings,
        homepage,
        pages,
        topKeywords: buildTopKeywords(pages),
        suggestions: buildSuggestions(pages),
    };
}

module.exports = {
    DEFAULT_GLOBAL_SETTINGS,
    DEFAULT_PAGE,
    SYSTEM_SETTINGS_MAP,
    buildPublicSeoConfig,
    buildSeoResponse,
    stringifySystemValue,
};
