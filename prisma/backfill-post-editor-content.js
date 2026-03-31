const { getPrismaClient } = require('../src/database/prisma');
const { parse } = require('node-html-parser');
const { marked } = require('marked');

const prisma = getPrismaClient();

function createTextNode(text, marks = []) {
    if (!text) {
        return null;
    }

    const value = text.replace(/\s+/g, ' ');
    if (!value.trim()) {
        return null;
    }

    return {
        type: 'text',
        text: value,
        ...(marks.length ? { marks } : {}),
    };
}

function collectInlineContent(node, activeMarks = []) {
    if (node.nodeType === 3) {
        const textNode = createTextNode(node.rawText || node.text || '', activeMarks);
        return textNode ? [textNode] : [];
    }

    if (node.nodeType !== 1) {
        return [];
    }

    const tag = node.tagName?.toLowerCase();
    const marks = [...activeMarks];

    if (tag === 'strong' || tag === 'b') marks.push({ type: 'bold' });
    if (tag === 'em' || tag === 'i') marks.push({ type: 'italic' });
    if (tag === 'u') marks.push({ type: 'underline' });
    if (tag === 'code') marks.push({ type: 'code' });
    if (tag === 'a') {
        marks.push({
            type: 'link',
            attrs: {
                href: node.getAttribute('href') || '',
                target: node.getAttribute('target') || null,
            },
        });
    }

    return node.childNodes.flatMap((child) => collectInlineContent(child, marks));
}

function wrapBlock(type, content = [], attrs) {
    return {
        type,
        ...(attrs ? { attrs } : {}),
        ...(content.length ? { content } : {}),
    };
}

function convertList(listNode, ordered = false) {
    return wrapBlock(
        ordered ? 'orderedList' : 'bulletList',
        listNode.childNodes
            .filter((child) => child.tagName?.toLowerCase() === 'li')
            .map((item) =>
                wrapBlock('listItem', [
                    wrapBlock('paragraph', collectInlineContent(item)),
                ])
            )
    );
}

function convertNode(node) {
    if (node.nodeType === 3) {
        const paragraph = wrapBlock('paragraph', collectInlineContent(node));
        return paragraph.content ? [paragraph] : [];
    }

    if (node.nodeType !== 1) {
        return [];
    }

    const tag = node.tagName.toLowerCase();

    if (tag === 'h2' || tag === 'h3') {
        return [wrapBlock('heading', collectInlineContent(node), { level: tag === 'h2' ? 2 : 3 })];
    }

    if (tag === 'p') {
        return [wrapBlock('paragraph', collectInlineContent(node))];
    }

    if (tag === 'blockquote') {
        return [wrapBlock('blockquote', [wrapBlock('paragraph', collectInlineContent(node))])];
    }

    if (tag === 'pre') {
        const codeNode = node.querySelector('code');
        const text = codeNode?.innerText || node.innerText || '';
        return [wrapBlock('codeBlock', text ? [{ type: 'text', text }] : [])];
    }

    if (tag === 'ul') {
        return [convertList(node, false)];
    }

    if (tag === 'ol') {
        return [convertList(node, true)];
    }

    if (tag === 'hr') {
        return [wrapBlock('horizontalRule')];
    }

    if (tag === 'img') {
        const src = node.getAttribute('src');
        if (!src) {
            return [];
        }

        return [wrapBlock('paragraph', [{ type: 'text', text: src }])];
    }

    return node.childNodes.flatMap((child) => convertNode(child));
}

function htmlToEditorJson(html) {
    if (!html || !html.trim()) {
        return {
            type: 'doc',
            content: [wrapBlock('paragraph')],
        };
    }

    const root = parse(html, {
        comment: false,
    });

    const content = root.childNodes.flatMap((node) => convertNode(node)).filter(Boolean);

    return {
        type: 'doc',
        content: content.length ? content : [wrapBlock('paragraph')],
    };
}

function looksLikeHtml(content) {
    return /<\/?[a-z][\s\S]*>/i.test(content || '');
}

function resolveStructuredHtml(contentHtml, legacyContent) {
    const preferred = contentHtml || legacyContent || '';

    if (!preferred.trim()) {
        return '';
    }

    if (looksLikeHtml(preferred)) {
        return preferred;
    }

    return marked.parse(preferred);
}

async function main() {
    const posts = await prisma.post.findMany({
        select: {
            id: true,
            title: true,
            excerpt: true,
            subtitle: true,
            content: true,
            contentHtml: true,
            contentJson: true,
        },
    });

    let updatedCount = 0;

    for (const post of posts) {
        const resolvedHtml = resolveStructuredHtml(post.contentHtml, post.content);
        const nextSubtitle = post.subtitle || post.excerpt || null;
        const nextJson = post.contentJson || htmlToEditorJson(resolvedHtml);

        await prisma.post.update({
            where: { id: post.id },
            data: {
                subtitle: nextSubtitle,
                contentHtml: resolvedHtml,
                contentJson: nextJson,
            },
        });

        updatedCount += 1;
    }

    console.log(`Backfilled editor fields for ${updatedCount} posts.`);
}

main()
    .catch((error) => {
        console.error('Failed to backfill post editor content:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
