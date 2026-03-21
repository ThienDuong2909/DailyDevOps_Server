const express = require('express');
const request = require('supertest');

// Mock dependencies before requiring the router
jest.mock('../subscribers.service');
jest.mock('../../../middlewares/auth.middleware', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'admin-1', role: 'ADMIN' };
        next();
    },
    authorize: (...roles) => (req, res, next) => {
        if (roles.includes(req.user?.role)) {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden' });
        }
    },
}));

const subscribersService = require('../subscribers.service');
const subscribersRoutes = require('../subscribers.routes');

// Create test app
function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/subscribers', subscribersRoutes);
    // Error handler
    app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message,
        });
    });
    return app;
}

describe('Subscribers Routes', () => {
    let app;

    beforeAll(() => {
        app = createApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =============================================
    // POST /api/v1/subscribers
    // =============================================
    describe('POST /api/v1/subscribers', () => {
        it('should subscribe with valid email', async () => {
            subscribersService.subscribe.mockResolvedValue({
                message: 'Subscribed successfully',
                subscriber: { id: 'sub-1', email: 'test@example.com', isActive: true },
            });

            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'test@example.com' })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Subscribed successfully');
            expect(res.body.data.email).toBe('test@example.com');
        });

        it('should subscribe with email and name', async () => {
            subscribersService.subscribe.mockResolvedValue({
                message: 'Subscribed successfully',
                subscriber: { id: 'sub-2', email: 'john@example.com', name: 'John' },
            });

            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'john@example.com', name: 'John' })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(subscribersService.subscribe).toHaveBeenCalledWith({
                email: 'john@example.com',
                name: 'John',
            });
        });

        it('should reject invalid email', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'not-an-email' })
                .expect(400);

            expect(subscribersService.subscribe).not.toHaveBeenCalled();
        });

        it('should reject empty body', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({})
                .expect(400);

            expect(subscribersService.subscribe).not.toHaveBeenCalled();
        });
    });

    // =============================================
    // POST /api/v1/subscribers/unsubscribe
    // =============================================
    describe('POST /api/v1/subscribers/unsubscribe', () => {
        it('should unsubscribe with valid token', async () => {
            subscribersService.unsubscribe.mockResolvedValue({
                message: 'Unsubscribed successfully',
            });

            const res = await request(app)
                .post('/api/v1/subscribers/unsubscribe')
                .send({ token: 'valid-token-123' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Unsubscribed successfully');
        });

        it('should reject missing token', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers/unsubscribe')
                .send({})
                .expect(400);

            expect(subscribersService.unsubscribe).not.toHaveBeenCalled();
        });
    });

    // =============================================
    // GET /api/v1/subscribers (admin)
    // =============================================
    describe('GET /api/v1/subscribers', () => {
        it('should return paginated list for admin', async () => {
            subscribersService.findAll.mockResolvedValue({
                data: [{ id: 'sub-1', email: 'a@test.com' }],
                meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
            });

            const res = await request(app)
                .get('/api/v1/subscribers')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });

        it('should pass query params to service', async () => {
            subscribersService.findAll.mockResolvedValue({
                data: [],
                meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
            });

            await request(app)
                .get('/api/v1/subscribers?page=2&limit=10&isActive=true')
                .expect(200);

            expect(subscribersService.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: '2',
                    limit: '10',
                    isActive: 'true',
                })
            );
        });
    });

    // =============================================
    // GET /api/v1/subscribers/stats (admin)
    // =============================================
    describe('GET /api/v1/subscribers/stats', () => {
        it('should return subscriber stats', async () => {
            subscribersService.getStats.mockResolvedValue({
                total: 100,
                active: 85,
                inactive: 15,
            });

            const res = await request(app)
                .get('/api/v1/subscribers/stats')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe(100);
            expect(res.body.data.active).toBe(85);
        });
    });

    // =============================================
    // DELETE /api/v1/subscribers/:id (admin)
    // =============================================
    describe('DELETE /api/v1/subscribers/:id', () => {
        it('should delete subscriber', async () => {
            subscribersService.delete.mockResolvedValue({});

            const res = await request(app)
                .delete('/api/v1/subscribers/sub-1')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Subscriber deleted');
            expect(subscribersService.delete).toHaveBeenCalledWith('sub-1');
        });
    });
});
