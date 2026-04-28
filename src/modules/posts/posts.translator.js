const config = require('../../config');
const { BadRequestError } = require('../../middlewares/error.middleware');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Primary text model is read from env (defaults to gemini-3-flash-preview).
// Fallback models are stable Gemini Flash variants known to handle short
// translation prompts reliably on the free tier. The list is deduped at
// runtime in case the configured primary already appears in the fallbacks.
const FALLBACK_TEXT_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
];

const getTranslationModels = () => {
    const primary = config.gemini.textModel || 'gemini-3-flash-preview';
    const ordered = [primary, ...FALLBACK_TEXT_MODELS];
    return Array.from(new Set(ordered));
};

const MAX_CHUNK_SIZE = 3500;

const executeTranslationRequest = async (model, prompt, apiKey) => {
    const response = await fetch(
        `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                    // Translation is mechanical work; reasoning tokens just
                    // burn budget without improving output. Gemini 3 models
                    // default to thinking on, so we explicitly opt out.
                    thinkingConfig: { thinkingBudget: 0 },
                },
            }),
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage =
            data?.error?.message ||
            data?.message ||
            `Gemini HTTP ${response.status}`;
        throw new Error(`Gemini HTTP ${response.status}: ${errorMessage}`);
    }

    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const content = candidate?.content?.parts?.[0]?.text;

    if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
        throw new Error(`PROVIDER_FAILED: Gemini blocked output (${finishReason}).`);
    }

    if (!content?.trim()) {
        throw new Error('PROVIDER_FAILED: No content returned from AI translation.');
    }

    return content;
};

const stripCodeFence = (text, lang) => {
    const openPattern = new RegExp(`^\`\`\`${lang}\\n?`);
    const closePattern = /\n?```$/;
    return text.replace(openPattern, '').replace(closePattern, '');
};

const cleanTranslatedContent = (content) => {
    let cleaned = content;

    // Remove markdown wrappers if AI returned them
    if (cleaned.startsWith('```html')) {
        cleaned = stripCodeFence(cleaned, 'html');
    }
    if (cleaned.startsWith('```markdown')) {
        cleaned = stripCodeFence(cleaned, 'markdown');
    }
    // Remove any leading explanation text before actual HTML
    const htmlStart = cleaned.indexOf('<');
    if (htmlStart > 0 && htmlStart < 200) {
        const beforeHtml = cleaned.slice(0, htmlStart).trim();
        // Only strip if it looks like an explanation, not actual content
        if (!beforeHtml.includes('\n\n') && beforeHtml.length < 150) {
            cleaned = cleaned.slice(htmlStart);
        }
    }

    return cleaned.trim();
};

/**
 * Split HTML by heading tags to create chunks that don't break structure
 */
const chunkHTML = (html, maxChars) => {
    const parts = html.split(/(?=<h[1-3]>)/i);
    const chunks = [];
    let temp = '';

    for (const part of parts) {
        if (temp.length + part.length > maxChars && temp.length > 0) {
            chunks.push(temp.trim());
            temp = part;
        } else {
            temp += part;
        }
    }

    if (temp.trim().length > 0) {
        chunks.push(temp.trim());
    }

    return chunks.length > 0 ? chunks : [html];
};

const buildTranslationPrompt = (content, chunkInfo = null) => {
    const chunkNote = chunkInfo
        ? `\n\nNOTE: This is part ${chunkInfo.current}/${chunkInfo.total} of a longer article. Translate only this part. Do NOT add introductions or conclusions unless they exist in the original.`
        : '';

    return `You are a professional technical translator specializing in DevOps, Cloud Infrastructure, Kubernetes, and software engineering.

Translate the following Vietnamese HTML content into English.

CRITICAL RULES:
1. ONLY return the translated HTML content. Do NOT add any introductions, explanations, or commentary.
2. Preserve ALL HTML tags, structure, attributes, classes, IDs, and formatting exactly as they are.
3. Do NOT translate code blocks, commands, variable names, file paths, or technical identifiers.
4. Do NOT translate or modify: URLs, image src attributes, href links, code inside <code> or <pre> tags.
5. Keep technical terms in their standard English form (e.g., Kubernetes, Docker, CI/CD, etc.).
6. Translate naturally and professionally — avoid literal word-by-word translation.
7. Maintain the same tone and style as the original (technical blog/tutorial style).
8. Do NOT wrap the output in markdown code blocks.${chunkNote}

Vietnamese HTML content to translate:
---
${content}
---`;
};

const buildTitleTranslationPrompt = (title) => {
    return `Translate this Vietnamese blog post title to English. Return ONLY the translated title, nothing else. Keep technical terms as-is (Kubernetes, Docker, CI/CD, etc.).

Title: ${title}`;
};

const buildExcerptTranslationPrompt = (excerpt) => {
    return `Translate this Vietnamese blog excerpt/subtitle to English. Return ONLY the translated text, nothing else. Keep technical terms as-is.

Text: ${excerpt}`;
};

// A chunk that comes back with too many Vietnamese-only diacritics is almost
// certainly the model echoing the source text instead of translating it.
// Anything above the threshold gets retried with the next model.
const VIETNAMESE_DIACRITIC_REGEX = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/g;
const MIN_LENGTH_FOR_DIACRITIC_CHECK = 80;
const MAX_DIACRITIC_RATIO = 0.005;

const looksUntranslated = (text) => {
    if (!text || text.length < MIN_LENGTH_FOR_DIACRITIC_CHECK) {
        return false;
    }
    const diacritics = text.match(VIETNAMESE_DIACRITIC_REGEX);
    if (!diacritics) return false;
    const ratio = diacritics.length / text.length;
    return ratio > MAX_DIACRITIC_RATIO;
};

/**
 * Execute translation with model fallback
 */
const processWithFallback = async (prompt, apiKey, label = 'content') => {
    const models = getTranslationModels();
    let attempt = 0;
    let lastError = null;

    while (attempt < models.length) {
        const model = models[attempt];

        try {
            console.log(`[Translator] Translating ${label} with model: ${model}`);
            const rawOutput = await executeTranslationRequest(model, prompt, apiKey);
            const cleaned = cleanTranslatedContent(rawOutput);

            if (looksUntranslated(cleaned)) {
                throw new Error(
                    `PROVIDER_FAILED: Output still contains Vietnamese diacritics (model echoed source).`
                );
            }

            return cleaned;
        } catch (error) {
            lastError = error;
            attempt++;
            const isRetryable =
                error.message?.includes('429') ||
                error.message?.includes('500') ||
                error.message?.includes('502') ||
                error.message?.includes('503') ||
                error.message?.includes('524') ||
                error.message?.includes('rate-limited') ||
                error.message?.includes('PROVIDER_FAILED');

            if (isRetryable && attempt < models.length) {
                console.warn(
                    `[Translator] Model ${model} failed for ${label} (${error.message}). Falling back...`
                );
                await new Promise((r) => setTimeout(r, 2000));
            } else {
                const errMessage = isRetryable
                    ? 'All Gemini text models are overloaded or rate-limited. Please try again in a few minutes.'
                    : `Translation error: ${error.message}`;
                throw new BadRequestError(errMessage);
            }
        }
    }

    throw new BadRequestError(
        `Translation failed after exhausting all models. Last error: ${lastError?.message || 'unknown'}`
    );
};

/**
 * Remove surrounding quotes that AI may have added to a translated string
 */
const stripSurroundingQuotes = (text) => {
    return text.replaceAll(/(^["'])|(["']$)/g, '').trim();
};

/**
 * Translate the title field of a post
 */
const translateTitle = async (title, apiKey) => {
    if (!title?.trim()) {
        return title || '';
    }

    const translated = await processWithFallback(
        buildTitleTranslationPrompt(title),
        apiKey,
        'title'
    );
    return stripSurroundingQuotes(translated);
};

/**
 * Translate the excerpt field of a post
 */
const translateExcerpt = async (excerpt, apiKey) => {
    if (!excerpt?.trim()) {
        return '';
    }

    const translated = await processWithFallback(
        buildExcerptTranslationPrompt(excerpt),
        apiKey,
        'excerpt'
    );
    return stripSurroundingQuotes(translated);
};

const noopProgress = () => {};

/**
 * Translate the HTML content of a post, with chunking for large content.
 *
 * @param {string} rawContent - Source HTML
 * @param {string} apiKey - OpenRouter API key
 * @param {object} [options]
 * @param {(info: { current: number, total: number }) => void} [options.onChunk]
 *   Called after each chunk is translated so callers can update a progress
 *   counter. Not called for small (single-prompt) content — callers should
 *   infer 1/1 in that case.
 */
const translateContent = async (rawContent, apiKey, options = {}) => {
    const onChunk = options.onChunk || noopProgress;

    if (!rawContent?.trim()) {
        return '';
    }

    if (rawContent.length <= MAX_CHUNK_SIZE) {
        const result = await processWithFallback(
            buildTranslationPrompt(rawContent),
            apiKey,
            'content'
        );
        onChunk({ current: 1, total: 1 });
        return result;
    }

    console.log(`[Translator] Content is large (${rawContent.length} chars). Splitting into chunks...`);
    const chunks = chunkHTML(rawContent, MAX_CHUNK_SIZE);
    const translatedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunkPrompt = buildTranslationPrompt(chunks[i], {
            current: i + 1,
            total: chunks.length,
        });

        const chunkResult = await processWithFallback(
            chunkPrompt,
            apiKey,
            `chunk ${i + 1}/${chunks.length}`
        );

        translatedChunks.push(chunkResult);
        onChunk({ current: i + 1, total: chunks.length });

        // Rate-limiting guard between chunks
        if (i < chunks.length - 1) {
            await new Promise((r) => setTimeout(r, 1500));
        }
    }

    return translatedChunks.join('\n\n').trim();
};

/**
 * Translate a full post from Vietnamese to English
 * @param {object} post - The post object with title, subtitle/excerpt, content/contentHtml
 * @param {object} [options]
 * @param {(info: { phase: 'title'|'excerpt'|'content', current?: number, total?: number }) => void} [options.onProgress]
 *   Fired as each phase/chunk completes so long-running callers (the job
 *   worker) can surface progress without needing to introspect internals.
 * @returns {Promise<{title: string, subtitle: string, excerpt: string, content: string, contentHtml: string, slug: string}>}
 */
const translatePost = async (post, options = {}) => {
    const apiKey = config.gemini.apiKey;
    const onProgress = options.onProgress || noopProgress;

    if (!apiKey) {
        throw new BadRequestError('GEMINI_API_KEY is not configured on the server.');
    }

    const rawContent = post.contentHtml || post.content || '';
    const originalExcerpt = post.subtitle || post.excerpt || '';

    if (!rawContent.trim() && !post.title?.trim()) {
        throw new BadRequestError('Post must have title or content to translate.');
    }

    const translatedTitle = await translateTitle(post.title, apiKey);
    onProgress({ phase: 'title' });

    const translatedExcerpt = await translateExcerpt(originalExcerpt, apiKey);
    onProgress({ phase: 'excerpt' });

    const translatedContent = await translateContent(rawContent, apiKey, {
        onChunk: ({ current, total }) =>
            onProgress({ phase: 'content', current, total }),
    });

    const { generateSlug } = require('./posts.helpers');
    const translatedSlug = generateSlug(translatedTitle);

    return {
        title: translatedTitle,
        subtitle: translatedExcerpt,
        excerpt: translatedExcerpt,
        content: translatedContent,
        contentHtml: translatedContent,
        slug: translatedSlug,
    };
};

module.exports = {
    translatePost,
    // Exported for testing
    cleanTranslatedContent,
    chunkHTML,
    buildTranslationPrompt,
    buildTitleTranslationPrompt,
    buildExcerptTranslationPrompt,
    stripSurroundingQuotes,
    looksUntranslated,
    getTranslationModels,
};
