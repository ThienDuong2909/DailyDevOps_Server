const settingsRepository = require('./settings.repository');
const { buildSettingsResponse, buildUpsertOperations } = require('./settings.helpers');

class SettingsService {
    async getSettings() {
        const settings = await settingsRepository.findMany({
            orderBy: [{ group: 'asc' }, { key: 'asc' }],
        });

        return buildSettingsResponse(settings);
    }

    async updateSettings(payload) {
        const operations = buildUpsertOperations(payload);

        await Promise.all(operations.map((operation) => settingsRepository.upsert(operation)));

        return this.getSettings();
    }
}

module.exports = new SettingsService();
