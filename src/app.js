const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const postsRoutes = require('./modules/posts/posts.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const tagsRoutes = require('./modules/tags/tags.routes');
const commentsRoutes = require('./modules/comments/comments.routes');
const usersRoutes = require('./modules/users/users.routes');

const app = express();

// ============================================
// MIDDLEWARES
// ============================================

// Security
app.use(helmet());

// CORS
app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(`/${config.apiPrefix}/`, limiter);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'DevOps Blog API is running',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
    });
});

// ============================================
// API ROUTES
// ============================================

app.use(`/${config.apiPrefix}/auth`, authRoutes);
app.use(`/${config.apiPrefix}/posts`, postsRoutes);
app.use(`/${config.apiPrefix}/categories`, categoriesRoutes);
app.use(`/${config.apiPrefix}/tags`, tagsRoutes);
app.use(`/${config.apiPrefix}/comments`, commentsRoutes);
app.use(`/${config.apiPrefix}/users`, usersRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
