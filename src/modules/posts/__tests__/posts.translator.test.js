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
    looksUntranslated,
    getTranslationModels,
} = require('../posts.translator');

describe('posts.translator', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        config.gemini = config.gemini || {};
        config.gemini.apiKey = 'test-api-key';
        config.gemini.textModel = 'gemini-3-flash-preview';
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

    // ───────────────────────────── looksUntranslated ─────────────────────────────

    describe('looksUntranslated', () => {
        it('returns false for short strings (under threshold)', () => {
            expect(looksUntranslated('Tiêu đề')).toBe(false);
        });

        it('returns false for English-only long output', () => {
            const longEnglish =
                'This is a long paragraph in English explaining how to deploy a Kubernetes cluster on a fresh server using Ansible playbooks and modern DevOps tooling.';
            expect(looksUntranslated(longEnglish)).toBe(false);
        });

        it('returns false for English text that preserves Vietnamese proper nouns', () => {
            // Real-world translation output may keep author names, place names,
            // or quoted Vietnamese terms. These should not be flagged as
            // untranslated.
            const englishWithNouns =
                'The tutorial was originally published by Nguyễn Văn on the FPT Software blog and covers deploying applications to cloud infrastructure on Đà Nẵng data centers.';
            expect(looksUntranslated(englishWithNouns)).toBe(false);
        });

        it('returns true when long output is dense with Vietnamese diacritics', () => {
            const stillVietnamese =
                'Bài viết này hướng dẫn cách triển khai ứng dụng lên Kubernetes bằng Ansible và các công cụ DevOps hiện đại trên máy chủ Ubuntu.';
            expect(looksUntranslated(stillVietnamese)).toBe(true);
        });
    });

    // ───────────────────────────── getTranslationModels ───────────────────────────

    describe('getTranslationModels', () => {
        it('puts the configured primary model first', () => {
            config.gemini.textModel = 'gemini-3-flash-preview';
            const models = getTranslationModels();
            expect(models[0]).toBe('gemini-3-flash-preview');
            expect(models).toContain('gemini-2.5-flash');
            expect(models).toContain('gemini-2.0-flash');
        });

        it('does not duplicate when primary already present in fallbacks', () => {
            config.gemini.textModel = 'gemini-2.0-flash';
            const models = getTranslationModels();
            expect(models.filter((m) => m === 'gemini-2.0-flash')).toHaveLength(1);
            expect(models[0]).toBe('gemini-2.0-flash');
        });
    });

    // ───────────────────────────── translatePost ──────────────────────────────

    describe('translatePost', () => {
        const mockGeminiSuccess = (text) => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [
                        {
                            content: { parts: [{ text }] },
                            finishReason: 'STOP',
                        },
                    ],
                }),
            });
        };

        it('should throw BadRequestError if API key is missing', async () => {
            config.gemini.apiKey = '';
            await expect(translatePost({ title: 'Test' })).rejects.toThrow(BadRequestError);
            await expect(translatePost({ title: 'Test' })).rejects.toThrow(
                'GEMINI_API_KEY is not configured on the server.'
            );
        });

        it('should throw BadRequestError if post has no title or content', async () => {
            await expect(translatePost({ title: '', content: '' })).rejects.toThrow(BadRequestError);
            await expect(translatePost({ title: '', content: '' })).rejects.toThrow(
                'Post must have title or content to translate.'
            );
        });

        it('should translate a post with title and short content', async () => {
            mockGeminiSuccess('Translated output');

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

        it('calls the Gemini generateContent endpoint with the configured model', async () => {
            mockGeminiSuccess('English Title');

            await translatePost({ title: 'Tiêu đề', content: '' });

            const [url, init] = global.fetch.mock.calls[0];
            expect(url).toContain('generativelanguage.googleapis.com');
            expect(url).toContain('gemini-3-flash-preview:generateContent');
            expect(init.headers['x-goog-api-key']).toBe('test-api-key');
            const body = JSON.parse(init.body);
            expect(body.contents[0].parts[0].text).toContain('Title: Tiêu đề');
            expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
        });

        it('should translate a post with title only (no content)', async () => {
            mockGeminiSuccess('English Title');

            const result = await translatePost({
                title: 'Tiêu đề',
                content: '',
            });

            expect(result.title).toBe('English Title');
            expect(result.content).toBe('');
            expect(global.fetch).toHaveBeenCalledTimes(1); // title only
        });

        it('should translate a post with content only (no title)', async () => {
            mockGeminiSuccess('Translated content');

            const result = await translatePost({
                title: '',
                contentHtml: '<p>Content</p>',
            });

            expect(result.title).toBe('');
            expect(result.content).toBe('Translated content');
            expect(global.fetch).toHaveBeenCalledTimes(1); // content only
        });

        it('should retry on 429 error and succeed via fallback model', async () => {
            global.fetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    json: async () => ({ error: { message: 'Rate limited' } }),
                })
                .mockResolvedValue({
                    ok: true,
                    json: async () => ({
                        candidates: [
                            {
                                content: { parts: [{ text: 'Fallback Success' }] },
                                finishReason: 'STOP',
                            },
                        ],
                    }),
                });

            const result = await translatePost({ title: 'Test', content: '' });
            expect(result.title).toBe('Fallback Success');
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should fall back when first model returns untranslated Vietnamese', async () => {
            const stillVietnamese =
                'Bài viết này hướng dẫn cách triển khai ứng dụng lên Kubernetes bằng Ansible và các công cụ DevOps hiện đại trên máy chủ Ubuntu.';

            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        candidates: [
                            {
                                content: { parts: [{ text: stillVietnamese }] },
                                finishReason: 'STOP',
                            },
                        ],
                    }),
                })
                .mockResolvedValue({
                    ok: true,
                    json: async () => ({
                        candidates: [
                            {
                                content: { parts: [{ text: 'Properly translated paragraph in English about Kubernetes deployment and DevOps tooling.' }] },
                                finishReason: 'STOP',
                            },
                        ],
                    }),
                });

            const result = await translatePost({ title: 'Test', content: '' });
            expect(result.title).toContain('Properly translated');
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should throw PROVIDER_FAILED if no candidate text returned', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ candidates: [] }),
            });

            await expect(
                translatePost({ title: 'Test', content: '' })
            ).rejects.toThrow(
                'All Gemini text models are overloaded or rate-limited. Please try again in a few minutes.'
            );
        });

        it('should surface SAFETY block as PROVIDER_FAILED and exhaust fallbacks', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '' }] } }],
                }),
            });

            await expect(
                translatePost({ title: 'Test', content: '' })
            ).rejects.toThrow(
                'All Gemini text models are overloaded or rate-limited. Please try again in a few minutes.'
            );
        });

        it('should strip quotes from translated title', async () => {
            mockGeminiSuccess('"Quoted Title"');

            const result = await translatePost({
                title: 'Tiêu đề',
                content: '',
            });

            expect(result.title).toBe('Quoted Title');
        });
    });
});
