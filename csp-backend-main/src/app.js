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

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

/* Request tracing */
app.use(requestIdMiddleware);

/* Response hardening */
app.use(secureErrorResponses);

/* Security headers */
app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'"],
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
      hsts: process.env.NODE_ENV === 'production'
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

/* CORS configuration */
const envOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173'
];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['X-CSRF-Token']
    })
);

/* Body parsing */
app.use(express.json({ limit: '10kb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* CSRF protection */
app.use(csrfProtection);

/* Global API rate limiter */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests',
      errorCode: 'RATE_LIMITED'
    });
  }
});

app.use(globalLimiter);

/* Health check */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      success: true,
      // Added: simple security-aware health payload without changing the route.
      status: 'ok',
      security: 'enabled'
    });

  } catch {

    return res.status(500).json({
      success: false,
      status: 'error',
      security: 'enabled'
    });

  }
});

/* Dev-only security test hook */
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/security/test', (req, res) => {
    return res.status(200).json({
      csrf: 'enabled',
      rateLimit: 'active',
      jwtExpiry: ACCESS_TOKEN_TTL
    });
  });
}

/* API routes */

app.use('/api/auth', authRoutes);
app.use('/api/queries', blockedIpMiddleware, queryRoutes);
app.use('/api/admin', blockedIpMiddleware, adminRoutes);
app.use('/api/feedback', blockedIpMiddleware, feedbackRoutes);
app.use('/api/dashboard', blockedIpMiddleware, dashboardRoutes);

/* 404 handler */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    errorCode: 'NOT_FOUND'
  });
});

/* Error handler */
app.use(errorMiddleware);

module.exports = app;
