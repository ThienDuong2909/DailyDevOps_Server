const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../../config');
const { formatContentByGemini } = require('../posts.formatter');
const { BadRequestError } = require('../../../middlewares/error.middleware');

jest.mock('@google/generative-ai');
jest.mock('../../../config', () => ({
    gemini: {
        apiKey: 'test-api-key',
    },
}));

describe('formatContentByGemini', () => {
    let mockGenerateContent;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateContent = jest.fn();
        GoogleGenerativeAI.mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: mockGenerateContent,
            }),
        }));
    });

    it('should throw BadRequestError if API key is not configured', async () => {
        const originalApiKey = config.gemini.apiKey;
        config.gemini.apiKey = '';

        await expect(formatContentByGemini('some content')).rejects.toThrow(BadRequestError);
        await expect(formatContentByGemini('some content')).rejects.toThrow('Gemini API key is not configured.');

        config.gemini.apiKey = originalApiKey;
    });

    it('should return successfully formatted content', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => 'formatted expected content',
            },
        });

        const result = await formatContentByGemini('raw content');
        expect(result).toBe('formatted expected content');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should remove ```markdown wrap if returned by AI', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => '```markdown\n# Hello\n```',
            },
        });

        const result = await formatContentByGemini('raw');
        expect(result).toBe('# Hello');
    });
    
    it('should remove ```markdown wrap without end newline if returned by AI', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => '```markdown\n# Hello```',
            },
        });

        const result = await formatContentByGemini('raw');
        expect(result).toBe('# Hello');
    });

    it('should default to empty string if text() is falsy', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => '',
            },
        });

        const result = await formatContentByGemini('raw');
        expect(result).toBe('');
    });

    it('should throw BadRequestError if generateContent fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error('AI failed'));

        await expect(formatContentByGemini('content')).rejects.toThrow(BadRequestError);
        await expect(formatContentByGemini('content')).rejects.toThrow('Failed to format content via Gemini API. AI failed');
    });
});
