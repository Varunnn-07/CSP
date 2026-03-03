const sanitizeHtml = require('sanitize-html');
const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');


async function createFeedback(req, res, next) {
  try {
    const { service_name, message, rating } = req.body;

    const cleanMessage = sanitizeHtml(message, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const result = await pool.query(`
      INSERT INTO feedback (user_id, service_name, message, rating)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      req.user.id,
      service_name,
      cleanMessage,
      rating
    ]);

    // Audit log
    try {
      await logAudit(
        pool,
        req.user.id,
        'feedback_created',
        'success',
        req.ip,
        req.headers['user-agent'],
        { rating }
      );
    } catch (logError) {
      console.error('Audit log failed:', logError);
    }

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    next(err);
  }
}


async function getMyFeedback(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT * FROM feedback
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);

    return res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    next(err);
  }
}


module.exports = {
  createFeedback,
  getMyFeedback
};