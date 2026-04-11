const config = require('../../config');
const mediaService = require('../media/media.service');
const { BadRequestError } = require('../../middlewares/error.middleware');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_IMAGE_NAME = 'ai-thumbnail.webp';
const MAX_PROMPT_CONTENT_LENGTH = 6000;

function stripHtml(value) {
    return String(value || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength).trim()}...`;
}

function buildImagePrompt({ title, subtitle, content, contentHtml }) {
    const normalizedTitle = String(title || '').trim();
    const normalizedSubtitle = String(subtitle || '').trim();
    const normalizedContent = stripHtml(contentHtml || content);

    if (!normalizedTitle && !normalizedContent) {
        throw new BadRequestError('Title or content is required to generate a thumbnail');
    }

    const articleContext = truncate(
        [normalizedTitle, normalizedSubtitle, normalizedContent].filter(Boolean).join('\n\n'),
        MAX_PROMPT_CONTENT_LENGTH
    );

    return [
        'Create a polished 16:9 blog thumbnail image for a technical article.',
        'Style: modern DevOps engineering illustration, cinematic lighting, crisp contrast, high detail, professional editorial cover.',
        'Include visual cues that match the article topic, infrastructure, cloud, automation, terminals, code, servers, or diagrams when relevant.',
        'Do not add any text, captions, letters, logos, watermarks, UI chrome, browser frames, or collage layout inside the image.',
        'The composition should be clean, bold, and suitable as a featured image on a professional blog homepage.',
        '',
        'Article context:',
        articleContext,
    ].join('\n');
}

function extractImagePart(responseBody) {
    const candidates = Array.isArray(responseBody?.candidates) ? responseBody.candidates : [];

    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            const inlineData = part?.inline_data || part?.inlineData;
            if (inlineData?.data) {
                return inlineData;
            }
        }
    }

    return null;
}

async function requestGeminiImage(prompt) {
    if (!config.gemini.apiKey) {
        throw new BadRequestError('GEMINI_API_KEY is not configured on the server');
    }

    const response = await fetch(
        `${GEMINI_API_BASE_URL}/${config.gemini.imageModel}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.gemini.apiKey,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }],
                    },
                ],
            }),
        }
    );

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage =
            responseBody?.error?.message ||
            responseBody?.message ||
            'Gemini image generation request failed';
        throw new BadRequestError(errorMessage);
    }

    const imagePart = extractImagePart(responseBody);
    if (!imagePart) {
        throw new BadRequestError('Gemini did not return an image for this article');
    }

    return imagePart;
}

async function generateFeaturedImage(input) {
    const prompt = buildImagePrompt(input);
    const imagePart = await requestGeminiImage(prompt);
    const mimeType = imagePart.mime_type || imagePart.mimeType || 'image/png';
    const extension = mediaService.resolveExtensionFromMimeType(mimeType) || '.png';
    const uploaded = await mediaService.uploadBuffer(
        {
            buffer: Buffer.from(imagePart.data, 'base64'),
            size: Buffer.byteLength(imagePart.data, 'base64'),
            mimetype: mimeType,
            originalname: DEFAULT_IMAGE_NAME.replace(/\.webp$/, extension),
        },
        { purpose: 'featured-image' }
    );

    return {
        prompt,
        imageUrl: uploaded.url,
        mimeType,
        storageKey: uploaded.key,
    };
}

module.exports = {
    generateFeaturedImage,
};
