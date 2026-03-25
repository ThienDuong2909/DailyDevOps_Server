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
