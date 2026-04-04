const { getPrismaClient } = require('../../database/prisma');

const prisma = getPrismaClient();

class OpsService {
    async exportSnapshot({ includeDrafts = true, includeActivityLogs = false, user }) {
        const postWhere = includeDrafts ? {} : { status: 'PUBLISHED' };

        const [posts, categories, tags, subscribers, users, settings, comments, activityLogs] =
            await Promise.all([
                prisma.post.findMany({
                    where: postWhere,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        status: true,
                        publishedAt: true,
                        scheduledAt: true,
                        createdAt: true,
                        updatedAt: true,
                        author: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                            },
                        },
                        category: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                        tags: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                }),
                prisma.category.findMany({
                    orderBy: { name: 'asc' },
                }),
                prisma.tag.findMany({
                    orderBy: { name: 'asc' },
                }),
                prisma.subscriber.findMany({
                    orderBy: { subscribedAt: 'desc' },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        status: true,
                        isActive: true,
                        confirmedAt: true,
                        subscribedAt: true,
                        unsubscribedAt: true,
                    },
                }),
                prisma.user.findMany({
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        isActive: true,
                        mfaEnabled: true,
                        emailVerifiedAt: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                }),
                prisma.systemSetting.findMany({
                    orderBy: [{ group: 'asc' }, { key: 'asc' }],
                    select: {
                        key: true,
                        value: true,
                        type: true,
                        group: true,
                        updatedAt: true,
                    },
                }),
                prisma.comment.findMany({
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        authorName: true,
                        authorEmail: true,
                        createdAt: true,
                        updatedAt: true,
                        postId: true,
                        userId: true,
                    },
                }),
                includeActivityLogs
                    ? prisma.activityLog.findMany({
                          orderBy: { createdAt: 'desc' },
                          take: 500,
                          select: {
                              id: true,
                              action: true,
                              entity: true,
                              entityId: true,
                              userId: true,
                              userEmail: true,
                              createdAt: true,
                              details: true,
                          },
                      })
                    : Promise.resolve([]),
            ]);

        const exportedAt = new Date().toISOString();

        await prisma.activityLog.create({
            data: {
                action: 'OPS_EXPORT_REQUEST',
                entity: 'Ops',
                userId: user.id,
                userEmail: user.email,
                details: JSON.stringify({
                    exportedAt,
                    includeDrafts,
                    includeActivityLogs,
                    posts: posts.length,
                    subscribers: subscribers.length,
                    users: users.length,
                }),
            },
        });

        return {
            meta: {
                exportedAt,
                exportedBy: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
                includeDrafts,
                includeActivityLogs,
            },
            counts: {
                posts: posts.length,
                categories: categories.length,
                tags: tags.length,
                subscribers: subscribers.length,
                users: users.length,
                settings: settings.length,
                comments: comments.length,
                activityLogs: activityLogs.length,
            },
            data: {
                posts,
                categories,
                tags,
                subscribers,
                users,
                settings,
                comments,
                activityLogs,
            },
        };
    }
}

module.exports = new OpsService();
