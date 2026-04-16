const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS post_translations (
            id VARCHAR(191) NOT NULL,
            locale VARCHAR(32) NOT NULL,
            title VARCHAR(191) NOT NULL,
            slug VARCHAR(191) NOT NULL,
            subtitle TEXT NULL,
            excerpt TEXT NULL,
            content TEXT NOT NULL,
            content_html LONGTEXT NULL,
            content_json JSON NULL,
            featured_image VARCHAR(191) NULL,
            meta_title VARCHAR(191) NULL,
            meta_description TEXT NULL,
            canonical_url VARCHAR(191) NULL,
            og_image VARCHAR(191) NULL,
            no_index BOOLEAN NOT NULL DEFAULT false,
            no_follow BOOLEAN NOT NULL DEFAULT false,
            focus_keywords JSON NULL,
            status ENUM('DRAFT', 'REVIEW', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
            published_at DATETIME(3) NULL,
            scheduled_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            post_id VARCHAR(191) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY post_translations_post_id_locale_key (post_id, locale),
            UNIQUE KEY post_translations_locale_slug_key (locale, slug),
            KEY post_translations_locale_status_published_at_idx (locale, status, published_at),
            KEY post_translations_post_id_idx (post_id),
            CONSTRAINT post_translations_post_id_fkey
                FOREIGN KEY (post_id) REFERENCES posts(id)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await prisma.$executeRawUnsafe(`
        ALTER TABLE post_translations
        MODIFY updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
    `);
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log('Post translations table is ready.');
    })
    .catch(async (error) => {
        console.error('Failed to migrate post translations table:', error);
        await prisma.$disconnect();
        process.exit(1);
    });
