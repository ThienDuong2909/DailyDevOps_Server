const config = require('../../../config');
const { BadRequestError } = require('../../../middlewares/error.middleware');
const {
    translatePost,
    cleanTranslatedContent,
    chunkHTML,
    buildTranslationPrompt,
    buildTitleTranslationPrompt,
    buildExcerptTranslationPrompt,
    stripSurroundingQuotes,
} = require('../posts.translator');

describe('posts.translator', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        config.openrouter = config.openrouter || {};
        config.openrouter.apiKey = 'test-api-key';
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    // ──────────────────────────── cleanTranslatedContent ────────────────────────────

    describe('cleanTranslatedContent', () => {
        it('should return trimmed content as-is', () => {
            expect(cleanTranslatedContent('  <p>Hello</p>  ')).toBe('<p>Hello</p>');
        });

        it('should strip ```html wrapper', () => {
            expect(cleanTranslatedContent('```html\n<p>Hello</p>\n```')).toBe('<p>Hello</p>');
        });

        it('should strip ```markdown wrapper', () => {
            expect(cleanTranslatedContent('```markdown\n# Title\n```')).toBe('# Title');
        });

        it('should remove leading explanation text before HTML', () => {
            expect(cleanTranslatedContent('Here is your translation:\n<p>Hello</p>')).toBe('<p>Hello</p>');
        });

        it('should NOT remove leading text if it contains paragraph breaks', () => {
            const input = 'First paragraph.\n\nSecond paragraph.\n<p>Hello</p>';
            expect(cleanTranslatedContent(input)).toBe(input.trim());
        });

        it('should NOT remove leading text if it is too long', () => {
            const longPrefix = 'A'.repeat(160) + '<p>Hello</p>';
            expect(cleanTranslatedContent(longPrefix)).toBe(longPrefix);
        });
    });

    // ──────────────────────────── chunkHTML ────────────────────────────

    describe('chunkHTML', () => {
        it('should return single chunk for short content', () => {
            const result = chunkHTML('<p>Short</p>', 1000);
            expect(result).toEqual(['<p>Short</p>']);
        });

        it('should split by heading tags', () => {
            const html = '<h2>Part 1</h2><p>Content 1</p><h2>Part 2</h2><p>Content 2</p>';
            const result = chunkHTML(html, 30);
            expect(result.length).toBeGreaterThan(1);
        });

        it('should return original content as single chunk if no headings', () => {
            const html = '<p>No headings here</p>';
            const result = chunkHTML(html, 5);
            expect(result).toEqual([html]);
        });
    });

    // ──────────────────────────── prompt builders ────────────────────────────

    describe('buildTranslationPrompt', () => {
        it('should build prompt without chunk info', () => {
            const prompt = buildTranslationPrompt('<p>Content</p>');
            expect(prompt).toContain('Vietnamese HTML content to translate');
            expect(prompt).toContain('<p>Content</p>');
            expect(prompt).not.toContain('NOTE: This is part');
        });

        it('should build prompt with chunk info', () => {
            const prompt = buildTranslationPrompt('<p>Content</p>', { current: 1, total: 3 });
            expect(prompt).toContain('NOTE: This is part 1/3');
        });
    });

    describe('buildTitleTranslationPrompt', () => {
        it('should include the title', () => {
            const prompt = buildTitleTranslationPrompt('Xin chào');
            expect(prompt).toContain('Title: Xin chào');
        });
    });

    describe('buildExcerptTranslationPrompt', () => {
        it('should include the excerpt', () => {
            const prompt = buildExcerptTranslationPrompt('Mô tả ngắn');
            expect(prompt).toContain('Text: Mô tả ngắn');
        });
    });

    // ──────────────────────────── stripSurroundingQuotes ────────────────────────────

    describe('stripSurroundingQuotes', () => {
        it('should remove surrounding double quotes', () => {
            expect(stripSurroundingQuotes('"Hello World"')).toBe('Hello World');
        });

        it('should remove surrounding single quotes', () => {
            expect(stripSurroundingQuotes("'Hello World'")).toBe('Hello World');
        });

        it('should not modify text without quotes', () => {
            expect(stripSurroundingQuotes('Hello World')).toBe('Hello World');
        });

        it('should handle empty string', () => {
            expect(stripSurroundingQuotes('')).toBe('');
        });
    });

    // ──────────────────────────── translatePost ────────────────────────────

    describe('translatePost', () => {
        const mockFetchSuccess = (content) => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content } }],
                }),
            });
        };

        it('should throw BadRequestError if API key is missing', async () => {
            config.openrouter.apiKey = '';
            await expect(translatePost({ title: 'Test' })).rejects.toThrow(BadRequestError);
            await expect(translatePost({ title: 'Test' })).rejects.toThrow('OpenRouter API key is not configured.');
        });

        it('should throw BadRequestError if post has no title or content', async () => {
            await expect(translatePost({ title: '', content: '' })).rejects.toThrow(BadRequestError);
            await expect(translatePost({ title: '', content: '' })).rejects.toThrow('Post must have title or content to translate.');
        });

        it('should translate a post with title and short content', async () => {
            mockFetchSuccess('Translated output');

            const result = await translatePost({
                title: 'Tiêu đề bài viết',
                subtitle: 'Mô tả ngắn',
                contentHtml: '<p>Nội dung bài viết</p>',
            });

            expect(result.title).toBe('Translated output');
            expect(result.subtitle).toBe('Translated output');
            expect(result.excerpt).toBe('Translated output');
            expect(result.content).toBe('Translated output');
            expect(result.contentHtml).toBe('Translated output');
            expect(result.slug).toBeDefined();
            expect(global.fetch).toHaveBeenCalledTimes(3); // title + excerpt + content
        });

        it('should translate a post with title only (no content)', async () => {
            mockFetchSuccess('English Title');

            const result = await translatePost({
                title: 'Tiêu đề',
                content: '',
            });

            expect(result.title).toBe('English Title');
            expect(result.content).toBe('');
            expect(global.fetch).toHaveBeenCalledTimes(1); // title only
        });

        it('should translate a post with content only (no title)', async () => {
            mockFetchSuccess('Translated content');

            const result = await translatePost({
                title: '',
                contentHtml: '<p>Content</p>',
            });

            expect(result.title).toBe('');
            expect(result.content).toBe('Translated content');
            expect(global.fetch).toHaveBeenCalledTimes(1); // content only
        });

        it('should throw when API returns error', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            await expect(
                translatePost({ title: 'Test', contentHtml: '<p>Test</p>' })
            ).rejects.toThrow(BadRequestError);
        });

        it('should strip quotes from translated title', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '"Quoted Title"' } }],
                }),
            });

            const result = await translatePost({
                title: 'Tiêu đề',
                content: '',
            });

            expect(result.title).toBe('Quoted Title');
        });
    });
});
