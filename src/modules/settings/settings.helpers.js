const DEFAULT_SETTINGS = {
    general: {
        siteName: 'DevOps Blog',
        siteUrl: 'https://blog.thienduong.info',
        siteDescription:
            'Expert articles on Kubernetes, CI/CD, Cloud Architecture, and DevOps best practices.',
        language: 'en',
        timezone: 'Asia/Ho_Chi_Minh',
        postsPerPage: 10,
        allowComments: true,
        moderateComments: true,
    },
    appearance: {
        darkModeDefault: true,
        primaryColor: '#00bcd4',
    },
    email: {
        smtpHost: '',
        smtpPort: '587',
        smtpUser: '',
        notifyNewComment: true,
        notifyNewUser: true,
    },
    maintenance: {
        maintenanceMode: false,
    },
    content: {
        headerNavigation: [
            { label: 'Articles', href: '/' },
            { label: 'Search', href: '/search' },
            { label: 'Newsletter', href: '/newsletter' },
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
        ],
        footerDescription:
            'The leading resource for DevOps professionals, SREs, and Platform Engineers. Building the future of infrastructure together.',
        footerContentLinks: [
            { label: 'Articles', href: '/blog' },
            { label: 'Search', href: '/search' },
            { label: 'Newsletter', href: '/newsletter' },
            { label: 'RSS Feed', href: '/rss.xml' },
        ],
        footerCompanyLinks: [
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Privacy', href: '/privacy-policy' },
            { label: 'Terms', href: '/terms-of-service' },
            { label: 'Cookies', href: '/cookie-policy' },
            { label: 'DMCA', href: '/dmca-policy' },
        ],
        trendingTools: [
            { name: 'Kubernetes', shortName: 'K8', description: 'Orchestration', href: '/search?q=Kubernetes' },
            { name: 'GitLab', shortName: 'Gi', description: 'DevOps Platform', href: '/search?q=GitLab' },
            { name: 'Terraform', shortName: 'Tf', description: 'Infrastructure as Code', href: '/search?q=Terraform' },
            { name: 'Ansible', shortName: 'An', description: 'Automation', href: '/search?q=Ansible' },
        ],
    },
};

const SETTINGS_DEFINITION = {
    siteName: { key: 'site_name', type: 'string', group: 'general' },
    siteUrl: { key: 'site_url', type: 'string', group: 'general' },
    siteDescription: { key: 'site_description', type: 'string', group: 'general' },
    language: { key: 'site_language', type: 'string', group: 'general' },
    timezone: { key: 'site_timezone', type: 'string', group: 'general' },
    postsPerPage: { key: 'posts_per_page', type: 'number', group: 'general' },
    allowComments: { key: 'allow_comments', type: 'boolean', group: 'general' },
    moderateComments: { key: 'moderate_comments', type: 'boolean', group: 'general' },
    darkModeDefault: { key: 'dark_mode_default', type: 'boolean', group: 'appearance' },
    primaryColor: { key: 'primary_color', type: 'string', group: 'appearance' },
    smtpHost: { key: 'smtp_host', type: 'string', group: 'email' },
    smtpPort: { key: 'smtp_port', type: 'string', group: 'email' },
    smtpUser: { key: 'smtp_user', type: 'string', group: 'email' },
    notifyNewComment: { key: 'notify_new_comment', type: 'boolean', group: 'email' },
    notifyNewUser: { key: 'notify_new_user', type: 'boolean', group: 'email' },
    maintenanceMode: { key: 'maintenance_mode', type: 'boolean', group: 'maintenance' },
    headerNavigation: { key: 'header_navigation', type: 'json', group: 'content' },
    footerDescription: { key: 'footer_description', type: 'string', group: 'content' },
    footerContentLinks: { key: 'footer_content_links', type: 'json', group: 'content' },
    footerCompanyLinks: { key: 'footer_company_links', type: 'json', group: 'content' },
    trendingTools: { key: 'trending_tools', type: 'json', group: 'content' },
};

function parseSettingValue(value, type) {
    if (type === 'boolean') {
        return value === 'true';
    }

    if (type === 'number') {
        return Number(value);
    }

    if (type === 'json') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    return value;
}

function stringifySettingValue(value, type) {
    if (type === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (type === 'number') {
        return String(value);
    }

    if (type === 'json') {
        return JSON.stringify(value);
    }

    return value ?? '';
}

function buildSettingsResponse(records) {
    const response = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    for (const record of records) {
        const definitionEntry = Object.entries(SETTINGS_DEFINITION).find(
            ([, definition]) => definition.key === record.key
        );

        if (!definitionEntry) {
            continue;
        }

        const [fieldName, definition] = definitionEntry;
        response[definition.group][fieldName] = parseSettingValue(record.value, record.type);
    }

    return response;
}

function buildUpsertOperations(payload) {
    return Object.entries(SETTINGS_DEFINITION).flatMap(([fieldName, definition]) => {
        const groupPayload = payload[definition.group];

        if (!groupPayload || !(fieldName in groupPayload)) {
            return [];
        }

        return [
            {
                where: { key: definition.key },
                update: {
                    value: stringifySettingValue(groupPayload[fieldName], definition.type),
                    type: definition.type,
                    group: definition.group,
                },
                create: {
                    key: definition.key,
                    value: stringifySettingValue(groupPayload[fieldName], definition.type),
                    type: definition.type,
                    group: definition.group,
                },
            },
        ];
    });
}

module.exports = {
    DEFAULT_SETTINGS,
    SETTINGS_DEFINITION,
    buildSettingsResponse,
    buildUpsertOperations,
};
