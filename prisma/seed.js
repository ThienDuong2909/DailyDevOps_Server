const { getPrismaClient } = require('../src/utils/prisma');
const argon2 = require('argon2');

const prisma = getPrismaClient();

const usersSeed = [
    {
        email: 'admin@devopsblog.com',
        password: 'Admin@123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        bio: 'Platform administrator and DevOps practitioner focused on delivery workflows.',
    },
    {
        email: 'sarah@devopsblog.com',
        password: 'Editor@123',
        firstName: 'Sarah',
        lastName: 'L',
        role: 'EDITOR',
        bio: 'Cloud architect writing about Kubernetes, platform engineering, and observability.',
    },
    {
        email: 'minh.ops@devopsblog.com',
        password: 'Moderator@123',
        firstName: 'Minh',
        lastName: 'Tran',
        role: 'MODERATOR',
        bio: 'Site moderator handling comment review, editorial QA, and release hygiene.',
    },
    {
        email: 'author@devopsblog.com',
        password: 'Author@123',
        firstName: 'An',
        lastName: 'Pham',
        role: 'AUTHOR',
        bio: 'Technical writer drafting platform engineering and cloud operations articles.',
    },
    {
        email: 'linh.reader@devopsblog.com',
        password: 'Viewer@123',
        firstName: 'Linh',
        lastName: 'Nguyen',
        role: 'VIEWER',
        bio: 'Regular reader following DevOps, CI/CD, and infrastructure automation topics.',
    },
];

const categoriesSeed = [
    {
        name: 'DevOps',
        slug: 'devops',
        description: 'Delivery workflows, platform thinking, and operational culture.',
        color: '#00bcd4',
        icon: 'terminal',
    },
    {
        name: 'CI/CD',
        slug: 'cicd',
        description: 'Pipelines, release automation, and deployment safety.',
        color: '#2196f3',
        icon: 'sync',
    },
    {
        name: 'Kubernetes',
        slug: 'kubernetes',
        description: 'Cluster operations, workloads, and production practices.',
        color: '#326ce5',
        icon: 'cloud',
    },
    {
        name: 'Observability',
        slug: 'observability',
        description: 'Metrics, logs, tracing, dashboards, and alerting.',
        color: '#4caf50',
        icon: 'monitoring',
    },
    {
        name: 'Security',
        slug: 'security',
        description: 'DevSecOps, access control, hardening, and policy enforcement.',
        color: '#f44336',
        icon: 'security',
    },
    {
        name: 'Cloud',
        slug: 'cloud',
        description: 'Cloud architecture, cost awareness, and managed platform tradeoffs.',
        color: '#ff9800',
        icon: 'cloud_upload',
    },
];

const tagsSeed = [
    'devops',
    'kubernetes',
    'docker',
    'terraform',
    'github-actions',
    'jenkins',
    'gitops',
    'prometheus',
    'grafana',
    'loki',
    'alertmanager',
    'security',
    'monitoring',
    'platform-engineering',
];

const subscribersSeed = [
    { email: 'john.subscriber@example.com', name: 'John Subscriber', isActive: true },
    { email: 'jane.platform@example.com', name: 'Jane Platform', isActive: true },
    { email: 'alex.sre@example.com', name: 'Alex SRE', isActive: true },
    { email: 'ops.digest@example.com', name: 'Ops Digest', isActive: false },
];

const settingsSeed = [
    { key: 'site_name', value: 'DevOps Blog', type: 'string', group: 'general' },
    {
        key: 'site_tagline',
        value: 'Automate Everything, Deploy Anywhere',
        type: 'string',
        group: 'general',
    },
    { key: 'site_language', value: 'en', type: 'string', group: 'general' },
    { key: 'posts_per_page', value: '10', type: 'number', group: 'general' },
    { key: 'allow_comments', value: 'true', type: 'boolean', group: 'general' },
    {
        key: 'robots_txt',
        value: 'User-agent: *\nAllow: /\nDisallow: /admin/',
        type: 'string',
        group: 'seo',
    },
];

const commentTemplates = [
    {
        content:
            'Solid walkthrough. We applied a similar setup in staging and the rollback story became much easier to reason about.',
        authorName: 'Alex Chen',
        authorEmail: 'alex.chen@example.com',
        authorIp: '192.168.10.21',
        status: 'APPROVED',
    },
    {
        content:
            'Could you share how you handle secret rotation for this flow? That part usually becomes painful after the first few releases.',
        authorName: 'Maria Rodriguez',
        authorEmail: 'maria.ops@example.com',
        authorIp: '192.168.10.34',
        status: 'PENDING',
    },
    {
        content:
            'We had the same issue with noisy alerts until we split warning and critical routes. Nice to see that mentioned here.',
        authorName: 'Hoang Vu',
        authorEmail: 'hoang.vu@example.com',
        authorIp: '192.168.10.45',
        status: 'APPROVED',
    },
];

async function seedUsers() {
    const seededUsers = [];

    for (const user of usersSeed) {
        const record = await prisma.user.upsert({
            where: { email: user.email },
            update: {
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                bio: user.bio,
                isActive: true,
                emailVerifiedAt: new Date(),
                emailVerificationToken: null,
                emailVerificationExpiresAt: null,
            },
            create: {
                email: user.email,
                password: await argon2.hash(user.password),
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                bio: user.bio,
                isActive: true,
                emailVerifiedAt: new Date(),
                emailVerificationToken: null,
                emailVerificationExpiresAt: null,
            },
        });

        seededUsers.push(record);
    }

    return seededUsers;
}

async function seedCategories() {
    return Promise.all(
        categoriesSeed.map((category) =>
            prisma.category.upsert({
                where: { slug: category.slug },
                update: {
                    name: category.name,
                    description: category.description,
                    color: category.color,
                    icon: category.icon,
                },
                create: category,
            })
        )
    );
}

async function seedTags() {
    return Promise.all(
        tagsSeed.map((tag) =>
            prisma.tag.upsert({
                where: { slug: tag },
                update: {
                    name: tag
                        .split('-')
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(' '),
                },
                create: {
                    name: tag
                        .split('-')
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(' '),
                    slug: tag,
                },
            })
        )
    );
}

async function seedSubscribers() {
    return Promise.all(
        subscribersSeed.map((subscriber) =>
            prisma.subscriber.upsert({
                where: { email: subscriber.email },
                update: {
                    name: subscriber.name,
                    isActive: subscriber.isActive,
                    unsubscribedAt: subscriber.isActive ? null : new Date(),
                },
                create: {
                    ...subscriber,
                    unsubscribedAt: subscriber.isActive ? null : new Date(),
                },
            })
        )
    );
}

async function seedSettings() {
    return Promise.all(
        settingsSeed.map((setting) =>
            prisma.systemSetting.upsert({
                where: { key: setting.key },
                update: {
                    value: setting.value,
                    type: setting.type,
                    group: setting.group,
                },
                create: setting,
            })
        )
    );
}

async function seedComments(existingPosts, seededUsers) {
    if (existingPosts.length === 0) {
        console.log('No posts found, skipping comment seed.');
        return 0;
    }

    const viewerUser = seededUsers.find((user) => user.role === 'VIEWER');
    let createdCount = 0;

    for (const [postIndex, post] of existingPosts.slice(0, 3).entries()) {
        for (const [commentIndex, template] of commentTemplates.entries()) {
            const lookupEmail = `${template.authorEmail}:${post.id}`;
            const existing = await prisma.comment.findFirst({
                where: {
                    postId: post.id,
                    OR: [
                        { authorEmail: template.authorEmail },
                        viewerUser
                            ? {
                                  userId: viewerUser.id,
                                  content: template.content,
                              }
                            : undefined,
                    ].filter(Boolean),
                },
            });

            if (existing) {
                continue;
            }

            await prisma.comment.create({
                data: {
                    content: template.content,
                    authorName: template.authorName,
                    authorEmail: template.authorEmail,
                    authorIp: template.authorIp,
                    status: template.status,
                    postId: post.id,
                    userId: commentIndex === 2 && viewerUser ? viewerUser.id : null,
                },
            });

            createdCount += 1;

            if (postIndex === 0 && commentIndex === 0 && viewerUser) {
                const parent = await prisma.comment.findFirst({
                    where: {
                        postId: post.id,
                        authorEmail: template.authorEmail,
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (parent) {
                    const replyExists = await prisma.comment.findFirst({
                        where: {
                            parentId: parent.id,
                            userId: viewerUser.id,
                        },
                    });

                    if (!replyExists) {
                        await prisma.comment.create({
                            data: {
                                content:
                                    'We tested this in our internal cluster too. The author recommendation about rollout safety checks helped a lot.',
                                parentId: parent.id,
                                postId: post.id,
                                userId: viewerUser.id,
                                status: 'APPROVED',
                            },
                        });

                        createdCount += 1;
                    }
                }
            }

            void lookupEmail;
        }
    }

    return createdCount;
}

async function seedActivityLogs(users) {
    if (users.length === 0) {
        return 0;
    }

    const admin = users.find((user) => user.role === 'ADMIN');

    if (!admin) {
        return 0;
    }

    const existing = await prisma.activityLog.count();
    if (existing > 0) {
        return 0;
    }

    const entries = [
        {
            action: 'LOGIN',
            entity: 'User',
            entityId: admin.id,
            userId: admin.id,
            userEmail: admin.email,
            ipAddress: '127.0.0.1',
            userAgent: 'Seed Script',
            details: JSON.stringify({ source: 'seed', note: 'Initial admin login' }),
        },
        {
            action: 'UPDATE',
            entity: 'SystemSetting',
            entityId: 'site_name',
            userId: admin.id,
            userEmail: admin.email,
            ipAddress: '127.0.0.1',
            userAgent: 'Seed Script',
            details: JSON.stringify({ source: 'seed', note: 'Base settings initialized' }),
        },
    ];

    await prisma.activityLog.createMany({ data: entries });
    return entries.length;
}

async function main() {
    console.log('Start seeding realistic baseline data...');

    const users = await seedUsers();
    console.log(`Users ready: ${users.length}`);

    const categories = await seedCategories();
    console.log(`Categories ready: ${categories.length}`);

    const tags = await seedTags();
    console.log(`Tags ready: ${tags.length}`);

    const subscribers = await seedSubscribers();
    console.log(`Subscribers ready: ${subscribers.length}`);

    const settings = await seedSettings();
    console.log(`System settings ready: ${settings.length}`);

    const existingPosts = await prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true },
    });

    const commentCount = await seedComments(existingPosts, users);
    console.log(`Comments inserted: ${commentCount}`);

    const activityCount = await seedActivityLogs(users);
    console.log(`Activity logs inserted: ${activityCount}`);

    console.log('Seeding finished successfully.');
    console.log('Default credentials:');
    console.log('- admin@devopsblog.com / Admin@123');
    console.log('- sarah@devopsblog.com / Editor@123');
    console.log('- minh.ops@devopsblog.com / Moderator@123');
    console.log('- author@devopsblog.com / Author@123');
    console.log('- linh.reader@devopsblog.com / Viewer@123');
}

main()
    .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
