const sanitizeHtml = require('sanitize-html');
const { CATEGORY_PRIORITY } = require('../constants/query.constants');
const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');


async function createQuery(req, res, next) {
  try {
    const { service_name, subject, message, category } = req.body;

    // Defensive category validation
    if (!CATEGORY_PRIORITY.hasOwnProperty(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        errorCode: 'INVALID_CATEGORY'
      });
    }

    // Sanitize user-controlled fields
    const cleanSubject = sanitizeHtml(subject, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const cleanMessage = sanitizeHtml(message, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const priority = CATEGORY_PRIORITY[category];

    const result = await pool.query(`
      INSERT INTO queries (user_id, service_name, subject, message, category, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.user.id,
      service_name,
      cleanSubject,
      cleanMessage,
      category,
      priority
    ]);

    // Audit log (non-blocking)
    try {
      await logAudit(
        pool,
        req.user.id,
        'query_created',
        'success',
        req.ip,
        req.headers['user-agent'],
        { category }
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


async function getMyQueries(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT * FROM queries
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


async function getAllQueries(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT * FROM queries
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    next(err);
  }
}


async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(`
      UPDATE queries
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Query not found',
        errorCode: 'NOT_FOUND'
      });
    }

    // Audit log (admin action)
    try {
      await logAudit(
        pool,
        req.user.id,
        'query_status_updated',
        'success',
        req.ip,
        req.headers['user-agent'],
        { queryId: id, newStatus: status }
      );
    } catch (logError) {
      console.error('Audit log failed:', logError);
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    next(err);
  }
}


async function replyToQuery(req, res, next) {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const cleanReply = sanitizeHtml(reply, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const result = await pool.query(`
      UPDATE queries
      SET admin_reply = $1,
          replied_by = $2,
          replied_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [cleanReply, req.user.id, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Query not found',
        errorCode: 'NOT_FOUND'
      });
    }

    // Audit log (admin action)
    try {
      await logAudit(
        pool,
        req.user.id,
        'query_replied',
        'success',
        req.ip,
        req.headers['user-agent'],
        { queryId: id }
      );
    } catch (logError) {
      console.error('Audit log failed:', logError);
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    next(err);
  }
}


module.exports = {
  createQuery,
  getMyQueries,
  getAllQueries,
  updateStatus,
  replyToQuery
};