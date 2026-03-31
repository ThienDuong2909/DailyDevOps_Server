const { getPrismaClient } = require('../src/database/prisma');

const prisma = getPrismaClient();

async function ensurePostEditorColumns() {
    await prisma.$executeRawUnsafe(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS subtitle TEXT NULL,
        ADD COLUMN IF NOT EXISTS content_html LONGTEXT NULL,
        ADD COLUMN IF NOT EXISTS content_json JSON NULL
    `);

    await prisma.$executeRawUnsafe(`
        UPDATE posts
        SET
            subtitle = COALESCE(subtitle, excerpt),
            content_html = COALESCE(content_html, content)
        WHERE subtitle IS NULL OR content_html IS NULL
    `);
}

async function main() {
    console.log('Ensuring new post editor columns exist...');
    await ensurePostEditorColumns();
    console.log('Post editor structure migration completed.');
}

main()
    .catch((error) => {
        console.error('Failed to migrate post editor structure:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
