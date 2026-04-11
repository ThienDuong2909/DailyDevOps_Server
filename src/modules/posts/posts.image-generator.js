const config = require('../../config');
const mediaService = require('../media/media.service');
const { BadRequestError } = require('../../middlewares/error.middleware');
const { parse } = require('node-html-parser');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_IMAGE_NAME = 'ai-thumbnail.webp';
const MAX_PROMPT_CONTENT_LENGTH = 6000;
const CATEGORY_STYLE_HINTS = [
    {
        keywords: ['ansible', 'automation', 'ci/cd', 'cicd', 'pipeline', 'jenkins', 'github actions'],
        hint: 'Favor terminal scenes, deployment pipelines, automation flows, server topology maps, and glowing console UI motifs.',
    },
    {
        keywords: ['kubernetes', 'k8s', 'container', 'docker', 'orchestration'],
        hint: 'Favor container clusters, node graphs, pods, control planes, cloud-native dashboards, and orchestrated infrastructure.',
    },
    {
        keywords: ['aws', 'azure', 'gcp', 'cloud', 'terraform', 'infrastructure'],
        hint: 'Favor cloud architecture diagrams, layered infrastructure, network links, regions, and infrastructure-as-code visuals.',
    },
    {
        keywords: ['security', 'devsecops', 'vulnerability', 'compliance', 'sonarqube', 'trivy'],
        hint: 'Favor security operations visuals, threat scanning, shields, secure pipelines, alert surfaces, and high-contrast monitoring scenes.',
    },
    {
        keywords: ['linux', 'server', 'nginx', 'apache', 'network', 'monitoring', 'prometheus', 'grafana'],
        hint: 'Favor Linux servers, rack systems, network routes, observability charts, terminal dashboards, and realistic ops environments.',
    },
];

function stripHtml(value) {
    const root = parse(String(value || ''));

    root.querySelectorAll('style,script').forEach((node) => node.remove());

    return root.text
        .replaceAll(/\s+/g, ' ')
        .trim();
}

function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength).trim()}...`;
}

function dedupe(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

function resolveStyleHints(topic) {
    const normalizedTopic = String(topic || '').toLowerCase();

    return dedupe(
        CATEGORY_STYLE_HINTS.flatMap((entry) =>
            entry.keywords.some((keyword) => normalizedTopic.includes(keyword)) ? [entry.hint] : []
        )
    );
}

function buildImagePrompt({ title, subtitle, content, contentHtml, categoryName, tagNames }) {
    const normalizedTitle = String(title || '').trim();
    const normalizedSubtitle = String(subtitle || '').trim();
    const normalizedContent = stripHtml(contentHtml || content);
    const normalizedCategory = String(categoryName || '').trim();
    const normalizedTags = Array.isArray(tagNames)
        ? tagNames.map((tag) => String(tag || '').trim()).filter(Boolean)
        : [];

    if (!normalizedTitle && !normalizedContent) {
        throw new BadRequestError('Title or content is required to generate a thumbnail');
    }

    const topicSummary = dedupe([normalizedCategory, ...normalizedTags, normalizedTitle]).join(' | ');
    const styleHints = resolveStyleHints(`${topicSummary}\n${normalizedSubtitle}\n${normalizedContent}`);
    const articleContext = truncate(
        [
            normalizedTitle,
            normalizedSubtitle,
            normalizedCategory ? `Category: ${normalizedCategory}` : '',
            normalizedTags.length > 0 ? `Tags: ${normalizedTags.join(', ')}` : '',
            normalizedContent,
        ]
            .filter(Boolean)
            .join('\n\n'),
        MAX_PROMPT_CONTENT_LENGTH
    );

    return [
        'Create a polished 16:9 blog thumbnail image for a technical article.',
        'Style: modern DevOps engineering illustration, cinematic lighting, crisp contrast, high detail, professional editorial cover.',
        'Include visual cues that match the article topic, infrastructure, cloud, automation, terminals, code, servers, or diagrams when relevant.',
        'Do not add any text, captions, letters, logos, watermarks, UI chrome, browser frames, or collage layout inside the image.',
        'The composition should be clean, bold, and suitable as a featured image on a professional blog homepage.',
        'Prefer one strong central concept with depth, atmosphere, and visually readable focal hierarchy.',
        ...(styleHints.length > 0 ? ['', 'Topic-specific visual guidance:', ...styleHints] : []),
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
    __testables: {
        stripHtml,
        truncate,
        dedupe,
        resolveStyleHints,
        buildImagePrompt,
        extractImagePart,
    },
};
