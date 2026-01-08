const { getPrismaClient } = require('../src/utils/prisma');
const argon2 = require('argon2');

const prisma = getPrismaClient();

async function main() {
    console.log('🌱 Start seeding...');

    // Create admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@devopsblog.com' },
        update: {},
        create: {
            email: 'admin@devopsblog.com',
            password: await argon2.hash('Admin@123'),
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            isActive: true,
        },
    });

    console.log('✅ Created admin user:', admin.email);

    // Create some categories
    const categories = await Promise.all([
        prisma.category.upsert({
            where: { slug: 'devops' },
            update: {},
            create: {
                name: 'DevOps',
                slug: 'devops',
                description: 'DevOps practices and tools',
                color: '#FF6B6B',
                icon: '🚀',
            },
        }),
        prisma.category.upsert({
            where: { slug: 'cloud' },
            update: {},
            create: {
                name: 'Cloud Computing',
                slug: 'cloud',
                description: 'Cloud platforms and services',
                color: '#4ECDC4',
                icon: '☁️',
            },
        }),
        prisma.category.upsert({
            where: { slug: 'docker' },
            update: {},
            create: {
                name: 'Docker',
                slug: 'docker',
                description: 'Containerization with Docker',
                color: '#2D6CDF',
                icon: '🐳',
            },
        }),
    ]);

    console.log('✅ Created', categories.length, 'categories');

    // Create some tags
    const tags = await Promise.all([
        prisma.tag.upsert({
            where: { slug: 'kubernetes' },
            update: {},
            create: { name: 'Kubernetes', slug: 'kubernetes' },
        }),
        prisma.tag.upsert({
            where: { slug: 'ci-cd' },
            update: {},
            create: { name: 'CI/CD', slug: 'ci-cd' },
        }),
        prisma.tag.upsert({
            where: { slug: 'aws' },
            update: {},
            create: { name: 'AWS', slug: 'aws' },
        }),
    ]);

    console.log('✅ Created', tags.length, 'tags');

    console.log('🌱 Seeding finished!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
