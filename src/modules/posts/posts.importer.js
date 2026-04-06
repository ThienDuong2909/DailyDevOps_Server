const path = require('path');
const AdmZip = require('adm-zip');
const { parse } = require('node-html-parser');
const { marked } = require('marked');
const mediaService = require('../media/media.service');

const IMAGE_MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.jfif': 'image/jpeg',
};

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\r\n/g, '\n');
}

function normalizeTitle(value) {
    const normalized = normalizeText(path.parse(String(value || '')).name);

    let title = normalized.replace(/\.[^.]+$/, '').trim();
    const segments = title.split(/\s+/);
    const lastSegment = segments.at(-1) || '';

    if (/^[0-9a-f]{32}$/i.test(lastSegment)) {
        segments.pop();
        title = segments.join(' ').trim();
    } else if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(lastSegment)) {
        segments.pop();
        title = segments.join(' ').trim();
    }

    return title;
}

function normalizeHtml(value) {
    return normalizeText(value)
        .replace(/<meta[^>]*>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .trim();
}

function guessMimeType(fileName) {
    const extension = path.extname(fileName || '').toLowerCase();
    return IMAGE_MIME_BY_EXT[extension] || null;
}

function getNestedArchiveEntries(fileBuffer) {
    const outerArchive = new AdmZip(fileBuffer);
    const nestedZipEntry = outerArchive
        .getEntries()
        .find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.zip'));

    if (!nestedZipEntry) {
        return outerArchive.getEntries();
    }

    const innerArchive = new AdmZip(nestedZipEntry.getData());
    return innerArchive.getEntries();
}

function buildAssetMap(entries) {
    return entries.reduce((map, entry) => {
        if (entry.isDirectory) {
            return map;
        }

        const baseName = path.basename(entry.entryName).toLowerCase();
        map.set(baseName, entry);
        return map;
    }, new Map());
}

function resolveTitle(documentEntry, htmlContent) {
    if (documentEntry) {
        return normalizeTitle(path.basename(documentEntry.entryName));
    }

    if (htmlContent) {
        const root = parse(htmlContent);
        const heading = root.querySelector('h1');
        if (heading?.text) {
            return normalizeTitle(heading.text);
        }
    }

    return 'Imported from Notion';
}

async function uploadEntryAsset(entry) {
    const originalName = path.basename(entry.entryName);
    const mimetype = guessMimeType(originalName);

    if (!mimetype) {
        return null;
    }

    return mediaService.uploadBuffer(
        {
            buffer: entry.getData(),
            size: entry.header.size,
            mimetype,
            originalname: originalName,
        },
        { purpose: 'post-media' }
    );
}

async function rewriteHtmlAssets(html, assetMap) {
    const root = parse(normalizeHtml(html));
    const images = root.querySelectorAll('img');
    const uploadedAssets = [];

    for (const image of images) {
        const source = image.getAttribute('src');
        if (!source || /^https?:\/\//i.test(source) || source.startsWith('/api/v1/media/object?key=')) {
            continue;
        }

        const fileName = decodeURIComponent(path.basename(source)).toLowerCase();
        const entry = assetMap.get(fileName);

        if (!entry) {
            continue;
        }

        const uploaded = await uploadEntryAsset(entry);
        if (!uploaded) {
            continue;
        }

        uploadedAssets.push(uploaded);
        image.setAttribute('src', uploaded.url);
    }

    const links = root.querySelectorAll('a');
    for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) {
            continue;
        }

        const fileName = decodeURIComponent(path.basename(href)).toLowerCase();
        const uploaded = uploadedAssets.find((item) => path.basename(decodeURIComponent(item.url)).toLowerCase() === fileName);
        if (uploaded) {
            link.setAttribute('href', uploaded.url);
        }
    }

    return {
        html: root.toString(),
        uploadedAssets,
    };
}

async function rewriteMarkdownAssets(markdown, assetMap) {
    const uploads = [];
    const rewrittenMarkdown = normalizeText(markdown).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        const fileName = decodeURIComponent(path.basename(src)).toLowerCase();
        const entry = assetMap.get(fileName);

        if (!entry) {
            return match;
        }

        uploads.push({ entry, alt });
        return `![${alt}](notion-asset://${fileName})`;
    });

    const uploadMap = new Map();
    for (const item of uploads) {
        const uploaded = await uploadEntryAsset(item.entry);
        if (uploaded) {
            uploadMap.set(path.basename(item.entry.entryName).toLowerCase(), uploaded);
        }
    }

    const finalMarkdown = rewrittenMarkdown.replace(/!\[([^\]]*)\]\(notion-asset:\/\/([^)]+)\)/g, (match, alt, fileName) => {
        const uploaded = uploadMap.get(String(fileName).toLowerCase());
        if (!uploaded) {
            return match;
        }

        return `![${alt}](${uploaded.url})`;
    });

    return {
        html: marked.parse(finalMarkdown),
        uploadedAssets: Array.from(uploadMap.values()),
    };
}

async function parseNotionExport(file) {
    const entries = getNestedArchiveEntries(file.buffer);
    const htmlEntry = entries.find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.html'));
    const markdownEntry = entries.find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.md'));

    if (!htmlEntry && !markdownEntry) {
        throw new Error('Khong tim thay file HTML hoac Markdown trong Notion export');
    }

    const assetMap = buildAssetMap(entries);
    const sourceEntry = htmlEntry || markdownEntry;
    const sourceContent = sourceEntry.getData().toString('utf8');

    const parsed = htmlEntry
        ? await rewriteHtmlAssets(sourceContent, assetMap)
        : await rewriteMarkdownAssets(sourceContent, assetMap);

    const title = resolveTitle(sourceEntry, htmlEntry ? sourceContent : parsed.html);
    const subtitleNode = parse(parsed.html).querySelector('p');
    const excerpt = normalizeText(subtitleNode?.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 280);

    const postData = {
        title,
        excerpt: excerpt || null,
        contentHtml: parsed.html,
        content: parsed.html,
        contentJson: null,
        featuredImage: parsed.uploadedAssets[0]?.url || null,
        status: 'DRAFT',
    };

    return {
        postData,
        meta: {
            importedAssetCount: parsed.uploadedAssets.length,
        },
    };
}

module.exports = {
    parseNotionExport,
};
