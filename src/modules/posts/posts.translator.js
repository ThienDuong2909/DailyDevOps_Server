const config = require('../../config');
const { BadRequestError } = require('../../middlewares/error.middleware');

const TRANSLATION_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-4b-it:free',
];

const MAX_CHUNK_SIZE = 3500;

const executeTranslationRequest = async (model, prompt, apiKey) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': config.appUrl || 'https://dailydevops.blog',
            'X-Title': 'DevOps Blog Translator',
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
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

/**
 * Execute translation with model fallback
 */
const processWithFallback = async (prompt, apiKey, label = 'content') => {
    let attempt = 0;

    while (attempt < TRANSLATION_MODELS.length) {
        const model = TRANSLATION_MODELS[attempt];

        try {
            console.log(`[Translator] Translating ${label} with model: ${model}`);
            const rawOutput = await executeTranslationRequest(model, prompt, apiKey);
            return cleanTranslatedContent(rawOutput);
        } catch (error) {
            attempt++;
            const isOverloaded =
                error.message?.includes('429') ||
                error.message?.includes('503') ||
                error.message?.includes('524') ||
                error.message?.includes('rate-limited') ||
                error.message?.includes('PROVIDER_FAILED');

            if (isOverloaded && attempt < TRANSLATION_MODELS.length) {
                console.warn(
                    `[Translator] Model ${model} overloaded for ${label}. Falling back...`
                );
                await new Promise((r) => setTimeout(r, 2000));
            } else {
                const errMessage = isOverloaded
                    ? 'All free AI models are overloaded or rate-limited. Please try again in a few minutes.'
                    : `Translation error: ${error.message}`;
                throw new BadRequestError(errMessage);
            }
        }
    }
};

/**
 * Remove surrounding quotes that AI may have added to a translated string
 */
const stripSurroundingQuotes = (text) => {
    return text.replaceAll(/^["']|["']$/g, '').trim();
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

/**
 * Translate the HTML content of a post, with chunking for large content
 */
const translateContent = async (rawContent, apiKey) => {
    if (!rawContent?.trim()) {
        return '';
    }

    if (rawContent.length <= MAX_CHUNK_SIZE) {
        return processWithFallback(
            buildTranslationPrompt(rawContent),
            apiKey,
            'content'
        );
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
 * @returns {Promise<{title: string, subtitle: string, excerpt: string, content: string, contentHtml: string, slug: string}>}
 */
const translatePost = async (post) => {
    const apiKey = config.openrouter.apiKey;

    if (!apiKey) {
        throw new BadRequestError('OpenRouter API key is not configured.');
    }

    const rawContent = post.contentHtml || post.content || '';
    const originalExcerpt = post.subtitle || post.excerpt || '';

    if (!rawContent.trim() && !post.title?.trim()) {
        throw new BadRequestError('Post must have title or content to translate.');
    }

    const translatedTitle = await translateTitle(post.title, apiKey);
    const translatedExcerpt = await translateExcerpt(originalExcerpt, apiKey);
    const translatedContent = await translateContent(rawContent, apiKey);

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
};
