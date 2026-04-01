const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const queryRoutes = require('./routes/query.routes');
const adminRoutes = require('./routes/admin.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const requestIdMiddleware = require('./middleware/request-id.middleware');
const blockedIpMiddleware = require('./middleware/blocked-ip.middleware');
const { csrfProtection } = require('./middleware/csrf.middleware');
const secureErrorResponses = require('./middleware/response-security.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const { ACCESS_TOKEN_TTL } = require('./security/token.service');

const app = express();

/* ------------------------------------------------ */
/* BASIC SETTINGS */
/* ------------------------------------------------ */

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

/* ------------------------------------------------ */
/* REQUEST TRACKING */
/* ------------------------------------------------ */

app.use(requestIdMiddleware);

/* ------------------------------------------------ */
/* SECURITY HEADERS (HELMET) */
/* ------------------------------------------------ */

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: [
                    "'self'",
                    "https://csp-3ch7.onrender.com",
                    "https://csp-1-dmb5.onrender.com/"
                ],
                imgSrc: ["'self'", 'data:'],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", 'data:'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"]
            }
        },
        frameguard: { action: 'deny' },
        hsts:
            process.env.NODE_ENV === 'production'
                ? {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true
                }
                : false,
        noSniff: true,
        crossOriginResourcePolicy: { policy: 'same-site' },
        referrerPolicy: { policy: 'no-referrer' }
    })
);

/* ------------------------------------------------ */
/* CORS CONFIGURATION (CRITICAL) */
/* ------------------------------------------------ */

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
        exposedHeaders: ['X-CSRF-Token']
    })
);

/* ------------------------------------------------ */
/* BODY PARSING */
/* ------------------------------------------------ */

app.use(express.json({ limit: '10kb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* ------------------------------------------------ */
/* CSRF PROTECTION */
/* ------------------------------------------------ */

app.use(csrfProtection);

/* ------------------------------------------------ */
/* RATE LIMITING */
/* ------------------------------------------------ */

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false
    })
);

/* ------------------------------------------------ */
/* HEALTH CHECK */
/* ------------------------------------------------ */

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        return res.status(200).json({
            success: true,
            status: 'ok'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'error'
        });
    }
});

/* ------------------------------------------------ */
/* DEV SECURITY TEST (OPTIONAL) */
/* ------------------------------------------------ */

if (process.env.NODE_ENV !== 'production') {
    app.get('/api/security/test', (req, res) => {
        return res.status(200).json({
            csrf: 'enabled',
            rateLimit: 'active',
            jwtExpiry: ACCESS_TOKEN_TTL
        });
    });
}

/* ------------------------------------------------ */
/* API ROUTES */
/* ------------------------------------------------ */

app.use('/api/auth', authRoutes);
app.use('/api/queries', blockedIpMiddleware, queryRoutes);
app.use('/api/admin', blockedIpMiddleware, adminRoutes);
app.use('/api/feedback', blockedIpMiddleware, feedbackRoutes);
app.use('/api/dashboard', blockedIpMiddleware, dashboardRoutes);

/* ------------------------------------------------ */
/* 404 HANDLER */
/* ------------------------------------------------ */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Resource not found',
        errorCode: 'NOT_FOUND'
    });
});

/* ------------------------------------------------ */
/* ERROR HANDLER */
/* ------------------------------------------------ */

app.use(errorMiddleware);

module.exports = app;