const sanitizeHtml = require('sanitize-html');
const pool = require('../config/db');
const { getClientIp } = require('../security/clientIp');
const { logAudit } = require('../utils/auditLogger');

function sanitizeText(value) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

async function createFeedback(req, res, next) {
  try {
    const { service_name, message, rating } = req.body;

    const cleanServiceName = sanitizeText(service_name);
    const cleanMessage = sanitizeText(message);

    const result = await pool.query(
      `
        INSERT INTO feedback (user_id, service_name, message, rating)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        req.user.id,
        cleanServiceName,
        cleanMessage,
        rating
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'feedback_created',
      eventType: 'query_created',
      severity: 'low',
      status: 'success',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      metadata: { rating }
    });

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

async function getMyFeedback(req, res, next) {
  try {
    const result = await pool.query(
      `
        SELECT * FROM feedback
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
}

async function getFeedbackById(req, res, next) {
  try {
    const result = await pool.query(
      `
        SELECT *
        FROM feedback
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
        errorCode: 'NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createFeedback,
  getMyFeedback,
  getFeedbackById
};
