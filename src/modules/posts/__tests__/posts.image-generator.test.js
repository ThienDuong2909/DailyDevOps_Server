jest.mock('../../../config', () => ({
    gemini: {
        apiKey: 'test-gemini-key',
        imageModel: 'gemini-2.5-flash-image',
    },
}));

jest.mock('../../media/media.service', () => ({
    resolveExtensionFromMimeType: jest.fn(),
    uploadBuffer: jest.fn(),
}));

const mediaService = require('../../media/media.service');
const {
    generateFeaturedImage,
    __testables: {
        stripHtml,
        truncate,
        dedupe,
        resolveStyleHints,
        buildImagePrompt,
        extractImagePart,
    },
} = require('../posts.image-generator');
const { BadRequestError } = require('../../../middlewares/error.middleware');

describe('posts.image-generator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        mediaService.resolveExtensionFromMimeType.mockReturnValue('.png');
        mediaService.uploadBuffer.mockResolvedValue({
            key: 'media/posts/2026-04-11/ai-thumb.png',
            url: '/api/v1/media/object?key=test-image',
        });
    });

    it('strips script, style, and html tags safely', () => {
        const result = stripHtml(
            '<style>.x{color:red}</style><script>alert(1)</script><p>Hello <strong>world</strong></p>'
        );

        expect(result).toBe('Hello world');
    });

    it('truncates long content with ellipsis', () => {
        expect(truncate('abcdef', 4)).toBe('abcd...');
        expect(truncate('abc', 4)).toBe('abc');
    });

    it('deduplicates truthy values only', () => {
        expect(dedupe(['linux', '', 'linux', null, 'docker'])).toEqual(['linux', 'docker']);
    });

    it('resolves style hints from technical topics', () => {
        const hints = resolveStyleHints('Ansible automation with Grafana monitoring');

        expect(hints.length).toBeGreaterThan(1);
        expect(hints.join(' ')).toContain('terminal scenes');
        expect(hints.join(' ')).toContain('observability');
    });

    it('builds a prompt with category and tag context', () => {
        const prompt = buildImagePrompt({
            title: 'Tim hieu ve Ansible',
            subtitle: 'Tu dong hoa ha tang',
            content: '<p>Su dung automation va server topology</p>',
            categoryName: 'Automation',
            tagNames: ['Ansible', 'CI/CD'],
        });

        expect(prompt).toContain('Create a polished 16:9 blog thumbnail image');
        expect(prompt).toContain('Category: Automation');
        expect(prompt).toContain('Tags: Ansible, CI/CD');
        expect(prompt).toContain('Topic-specific visual guidance:');
    });

    it('throws when prompt input is empty', () => {
        expect(() => buildImagePrompt({ title: '', content: '' })).toThrow(BadRequestError);
    });

    it('extracts inline image data from gemini response', () => {
        const part = extractImagePart({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                inline_data: {
                                    data: 'ZmFrZS1pbWFnZQ==',
                                    mime_type: 'image/png',
                                },
                            },
                        ],
                    },
                },
            ],
        });

        expect(part).toEqual({
            data: 'ZmFrZS1pbWFnZQ==',
            mime_type: 'image/png',
        });
    });

    it('generates and uploads a featured image', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inline_data: {
                                        data: Buffer.from('fake-image').toString('base64'),
                                        mime_type: 'image/png',
                                    },
                                },
                            ],
                        },
                    },
                ],
            }),
        });

        const result = await generateFeaturedImage({
            title: 'Docker monitoring guide',
            subtitle: 'Prometheus va Grafana',
            content: '<p>Cluster monitoring best practices</p>',
            categoryName: 'Monitoring',
            tagNames: ['Docker', 'Grafana'],
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(mediaService.uploadBuffer).toHaveBeenCalledTimes(1);
        expect(result.imageUrl).toBe('/api/v1/media/object?key=test-image');
        expect(result.mimeType).toBe('image/png');
        expect(result.prompt).toContain('Docker monitoring guide');
    });

    it('throws when gemini returns no image', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [],
            }),
        });

        await expect(
            generateFeaturedImage({
                title: 'Empty response case',
                content: '<p>Missing image</p>',
            })
        ).rejects.toThrow('Gemini did not return an image');
    });
});
