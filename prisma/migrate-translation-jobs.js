const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS translation_jobs (
            id VARCHAR(191) NOT NULL,
            post_id VARCHAR(191) NOT NULL,
            locale VARCHAR(32) NOT NULL DEFAULT 'en',
            status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
            progress INT NOT NULL DEFAULT 0,
            current_step VARCHAR(191) NULL,
            result_title TEXT NULL,
            result_slug VARCHAR(191) NULL,
            result_excerpt TEXT NULL,
            result_content LONGTEXT NULL,
            error TEXT NULL,
            started_by_id VARCHAR(191) NULL,
            started_by_role VARCHAR(32) NULL,
            started_at DATETIME(3) NULL,
            completed_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            KEY translation_jobs_post_id_status_created_at_idx (post_id, status, created_at),
            KEY translation_jobs_status_idx (status),
            CONSTRAINT translation_jobs_post_id_fkey
                FOREIGN KEY (post_id) REFERENCES posts(id)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // If the table already existed from a previous schema, make sure the
    // updated_at column has the right defaults.
    await prisma.$executeRawUnsafe(`
        ALTER TABLE translation_jobs
        MODIFY updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
    `);

    // Idempotently add started_by_role for installs that predate this column.
    // MySQL doesn't support `ADD COLUMN IF NOT EXISTS` before 8.0.29, so we
    // check information_schema first.
    const [roleColumn] = await prisma.$queryRawUnsafe(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'translation_jobs'
          AND COLUMN_NAME = 'started_by_role';
    `);
    if (!roleColumn) {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE translation_jobs
            ADD COLUMN started_by_role VARCHAR(32) NULL AFTER started_by_id;
        `);
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log('Translation jobs table is ready.');
    })
    .catch(async (error) => {
        console.error('Failed to migrate translation jobs table:', error);
        await prisma.$disconnect();
        process.exit(1);
    });
