const config = require('../../../config');
const { formatContentByGemini } = require('../posts.formatter');
const { BadRequestError } = require('../../../middlewares/error.middleware');

describe('formatContentByGemini (OpenRouter)', () => {
    let originalFetch;



    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        
        // Setup config since CI might not have this env loaded
        config.openrouter = config.openrouter || {};
        config.openrouter.apiKey = 'test-api-key';
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('should throw BadRequestError if content is not a string', async () => {
        await expect(formatContentByGemini(null)).rejects.toThrow(BadRequestError);
        await expect(formatContentByGemini(null)).rejects.toThrow('Content must be provided as a string.');
    });

    it('should throw BadRequestError if API key is not configured', async () => {
        const originalApiKey = config.openrouter.apiKey;
        config.openrouter.apiKey = '';

        await expect(formatContentByGemini('some content')).rejects.toThrow(BadRequestError);
        await expect(formatContentByGemini('some content')).rejects.toThrow('OpenRouter API key is not configured.');

        config.openrouter.apiKey = originalApiKey;
    });

    it('should return successfully formatted content', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [
                    { message: { content: 'formatted expected content' } }
                ]
            })
        });

        const result = await formatContentByGemini('raw content');
        expect(result).toBe('formatted expected content');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should remove ```markdown wrap if returned by AI', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [
                    { message: { content: '```markdown\n# Hello\n```' } }
                ]
            })
        });

        const result = await formatContentByGemini('raw');
        expect(result).toBe('# Hello');
    });
    
    it('should remove ```markdown wrap without end newline if returned by AI', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [
                    { message: { content: '```markdown\n# Hello```' } }
                ]
            })
        });

        const result = await formatContentByGemini('raw');
        expect(result).toBe('# Hello');
    });

    it('should throw BadRequestError if generateContent API fails', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized access'
        });

        await expect(formatContentByGemini('content')).rejects.toThrow(BadRequestError);
        await expect(formatContentByGemini('content')).rejects.toThrow('Failed to format content via AI. OpenRouter lỗi HTTP 401: Unauthorized access');
    });
});
