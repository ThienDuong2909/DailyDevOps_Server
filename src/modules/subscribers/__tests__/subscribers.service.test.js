// Mock Prisma before requiring the service
jest.mock('@prisma/client', () => {
    const mockPrismaClient = {
        subscriber: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mockPrismaClient) };
});
jest.mock('../subscribers.mailer', () => ({
    sendSubscriptionConfirmationEmail: jest.fn().mockResolvedValue({ skipped: false }),
}));

const { PrismaClient } = require('@prisma/client');
const subscribersService = require('../subscribers.service');

// Get the mock instance
const prisma = new PrismaClient();

describe('SubscribersService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =============================================
    // subscribe
    // =============================================
    describe('subscribe', () => {
        it('should create a new subscriber', async () => {
            prisma.subscriber.findUnique.mockResolvedValue(null);
            prisma.subscriber.create.mockResolvedValue({
                id: 'sub-1',
                email: 'test@example.com',
                name: null,
                status: 'PENDING',
                isActive: false,
                confirmToken: 'confirm-token',
                unsubscribeToken: 'mock-token',
            });

            const result = await subscribersService.subscribe({ email: 'test@example.com' });

            expect(result.message).toBe('Subscription created. Check your inbox to confirm.');
            expect(result.subscriber.email).toBe('test@example.com');
            expect(result.confirmationToken).toBeNull();
            expect(prisma.subscriber.create).toHaveBeenCalledTimes(1);
        });

        it('should create subscriber with name', async () => {
            prisma.subscriber.findUnique.mockResolvedValue(null);
            prisma.subscriber.create.mockResolvedValue({
                id: 'sub-2',
                email: 'john@example.com',
                name: 'John',
                status: 'PENDING',
                isActive: false,
                confirmToken: 'confirm-token-john',
            });

            const result = await subscribersService.subscribe({
                email: 'john@example.com',
                name: 'John',
            });

            expect(result.message).toBe('Subscription created. Check your inbox to confirm.');
            expect(prisma.subscriber.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        email: 'john@example.com',
                        name: 'John',
                    }),
                })
            );
        });

        it('should return already subscribed for active subscriber', async () => {
            prisma.subscriber.findUnique.mockResolvedValue({
                id: 'sub-1',
                email: 'test@example.com',
                status: 'CONFIRMED',
                isActive: true,
            });

            const result = await subscribersService.subscribe({ email: 'test@example.com' });

            expect(result.message).toBe('Already subscribed. You are already confirmed.');
            expect(prisma.subscriber.create).not.toHaveBeenCalled();
        });

        it('should refresh pending subscriber confirmation', async () => {
            prisma.subscriber.findUnique.mockResolvedValue({
                id: 'sub-1',
                email: 'test@example.com',
                isActive: false,
                status: 'PENDING',
                name: 'Old Name',
            });
            prisma.subscriber.update.mockResolvedValue({
                id: 'sub-1',
                email: 'test@example.com',
                isActive: false,
                status: 'PENDING',
                name: 'New Name',
                confirmToken: 'confirm-token-pending',
            });

            const result = await subscribersService.subscribe({
                email: 'test@example.com',
                name: 'New Name',
            });

            expect(result.message).toBe('Subscription pending. Check your inbox to confirm.');
            expect(prisma.subscriber.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { email: 'test@example.com' },
                    data: expect.objectContaining({
                        isActive: false,
                        unsubscribedAt: null,
                    }),
                })
            );
        });

        it('should restart unsubscribed subscriber flow', async () => {
            prisma.subscriber.findUnique.mockResolvedValue({
                id: 'sub-1',
                email: 'test@example.com',
                isActive: false,
                status: 'UNSUBSCRIBED',
                name: 'Old Name',
            });
            prisma.subscriber.update.mockResolvedValue({
                id: 'sub-1',
                email: 'test@example.com',
                isActive: false,
                status: 'PENDING',
                name: 'Old Name',
                confirmToken: 'confirm-token-restarted',
            });

            const result = await subscribersService.subscribe({
                email: 'test@example.com',
            });

            expect(result.message).toBe('Subscription restarted. Check your inbox to confirm.');
            expect(prisma.subscriber.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: 'Old Name',
                    }),
                })
            );
        });

        it('should expose fallback confirmation token when mailer is unavailable', async () => {
            const { sendSubscriptionConfirmationEmail } = require('../subscribers.mailer');

            sendSubscriptionConfirmationEmail.mockResolvedValueOnce({ skipped: true });
            prisma.subscriber.findUnique.mockResolvedValue(null);
            prisma.subscriber.create.mockResolvedValue({
                id: 'sub-fallback',
                email: 'fallback@example.com',
                name: null,
                status: 'PENDING',
                isActive: false,
                confirmToken: 'fallback-token',
                unsubscribeToken: 'unsubscribe-token',
            });

            const result = await subscribersService.subscribe({ email: 'fallback@example.com' });

            expect(result.message).toBe('Subscription created. Use the confirmation link below.');
            expect(result.confirmationToken).toBe('fallback-token');
        });
    });

    describe('confirm', () => {
        it('should confirm with valid token', async () => {
            prisma.subscriber.findFirst.mockResolvedValue({
                id: 'sub-1',
                confirmToken: 'valid-confirm-token',
                status: 'PENDING',
                isActive: false,
            });
            prisma.subscriber.update.mockResolvedValue({
                id: 'sub-1',
                status: 'CONFIRMED',
                isActive: true,
            });

            const result = await subscribersService.confirm('valid-confirm-token');

            expect(result.message).toBe('Subscription confirmed successfully');
            expect(prisma.subscriber.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'sub-1' },
                    data: expect.objectContaining({
                        status: 'CONFIRMED',
                        isActive: true,
                        confirmToken: null,
                    }),
                })
            );
        });

        it('should throw error with invalid confirmation token', async () => {
            prisma.subscriber.findFirst.mockResolvedValue(null);

            await expect(subscribersService.confirm('invalid-token')).rejects.toThrow(
                'Invalid confirmation token'
            );
        });
    });

    // =============================================
    // unsubscribe
    // =============================================
    describe('unsubscribe', () => {
        it('should unsubscribe with valid token', async () => {
            prisma.subscriber.findFirst.mockResolvedValue({
                id: 'sub-1',
                unsubscribeToken: 'valid-token',
            });
            prisma.subscriber.update.mockResolvedValue({});

            const result = await subscribersService.unsubscribe('valid-token');

            expect(result.message).toBe('Unsubscribed successfully');
            expect(prisma.subscriber.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'sub-1' },
                    data: expect.objectContaining({
                        status: 'UNSUBSCRIBED',
                        isActive: false,
                    }),
                })
            );
        });

        it('should throw error with invalid token', async () => {
            prisma.subscriber.findFirst.mockResolvedValue(null);

            await expect(subscribersService.unsubscribe('invalid-token')).rejects.toThrow(
                'Invalid unsubscribe token'
            );
        });
    });

    // =============================================
    // findAll
    // =============================================
    describe('findAll', () => {
        it('should return paginated subscribers', async () => {
            const mockSubscribers = [
                { id: 'sub-1', email: 'a@test.com', isActive: true },
                { id: 'sub-2', email: 'b@test.com', isActive: true },
            ];
            prisma.subscriber.findMany.mockResolvedValue(mockSubscribers);
            prisma.subscriber.count.mockResolvedValue(2);

            const result = await subscribersService.findAll({ page: 1, limit: 20 });

            expect(result.data).toEqual(mockSubscribers);
            expect(result.meta.total).toBe(2);
            expect(result.meta.page).toBe(1);
            expect(result.meta.totalPages).toBe(1);
        });

        it('should filter by isActive', async () => {
            prisma.subscriber.findMany.mockResolvedValue([]);
            prisma.subscriber.count.mockResolvedValue(0);

            await subscribersService.findAll({ page: 1, limit: 20, isActive: 'true' });

            expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { isActive: true },
                })
            );
        });

        it('should use default pagination values', async () => {
            prisma.subscriber.findMany.mockResolvedValue([]);
            prisma.subscriber.count.mockResolvedValue(0);

            const result = await subscribersService.findAll({});

            expect(result.meta.page).toBe(1);
            expect(result.meta.limit).toBe(20);
        });
    });

    // =============================================
    // getStats
    // =============================================
    describe('getStats', () => {
        it('should return subscriber statistics', async () => {
            prisma.subscriber.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(85)  // active
                .mockResolvedValueOnce(15)  // inactive
                .mockResolvedValueOnce(8)   // pending
                .mockResolvedValueOnce(77); // confirmed

            const stats = await subscribersService.getStats();

            expect(stats).toEqual({ total: 100, active: 85, inactive: 15, pending: 8, confirmed: 77 });
            expect(prisma.subscriber.count).toHaveBeenCalledTimes(5);
        });
    });

    // =============================================
    // delete
    // =============================================
    describe('delete', () => {
        it('should delete a subscriber by id', async () => {
            prisma.subscriber.delete.mockResolvedValue({ id: 'sub-1' });

            await subscribersService.delete('sub-1');

            expect(prisma.subscriber.delete).toHaveBeenCalledWith({
                where: { id: 'sub-1' },
            });
        });
    });
});
