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
        await expect(formatContentByGemini('content')).rejects.toThrow('OpenRouter lỗi HTTP 401: Unauthorized access');
    });

    it('should throw PROVIDER_FAILED error if no content returned', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [] // empty choices
            })
        });

        // Because PROVIDER_FAILED is treated as an overloaded error, it exhausts retries and throws the generic overloaded message
        await expect(formatContentByGemini('content')).rejects.toThrow('Tất cả các model AI miễn phí đều đang quá tải hoặc hết lượt (Rate Limited). Vui lòng thử lại sau vài phút.');
    });

    it('should retry with fallback model if 429 Rate Limit occurs', async () => {
        // First call fails with 429
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            text: async () => 'Rate limited'
        });
        
        // Second call succeeds
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'fallback success' } }]
            })
        });

        const result = await formatContentByGemini('content');
        expect(result).toBe('fallback success');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should split and process large content chunks', async () => {
        // Create content > 3500 chars with multiple headings
        const largeChunk1 = 'A'.repeat(2000);
        const largeChunk2 = 'B'.repeat(2000);
        const largeContent = `<h2>Heading 1</h2>${largeChunk1}<h2>Heading 2</h2>${largeChunk2}`;

        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'chunk processed' } }]
            })
        });

        const result = await formatContentByGemini(largeContent);
        // It should have split it into 2 chunks because each chunk would be ~2000 chars.
        expect(result).toBe('chunk processed\n\nchunk processed');
        // Fetch called twice
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
