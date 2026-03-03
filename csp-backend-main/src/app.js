const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const queryRoutes = require('./routes/query.routes');
const adminRoutes = require('./routes/admin.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

app.disable('x-powered-by');
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      success: true,
      status: 'healthy'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Database not reachable'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    errorCode: 'NOT_FOUND'
  });
});

app.use(errorMiddleware);

module.exports = app;
