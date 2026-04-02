const sanitizeHtml = require('sanitize-html');
const { CATEGORY_PRIORITY } = require('../constants/query.constants');
const pool = require('../config/db');
const { getClientIp } = require('../security/clientIp');
const { logAudit } = require('../utils/auditLogger');

function sanitizeText(value) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

async function createQuery(req, res, next) {
  try {
    const { service_name, subject, message, category } = req.body;

    if (!Object.prototype.hasOwnProperty.call(CATEGORY_PRIORITY, category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        errorCode: 'INVALID_CATEGORY'
      });
    }

    const cleanServiceName = sanitizeText(service_name);
    const cleanSubject = sanitizeText(subject);
    const cleanMessage = sanitizeText(message);

    if (!cleanServiceName || !cleanSubject || !cleanMessage) {
      return res.status(400).json({
        success: false,
        message: 'Service name, subject, and message must contain visible text.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const priority = CATEGORY_PRIORITY[category];

    const result = await pool.query(
      `
        INSERT INTO queries (user_id, service_name, subject, message, category, priority)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        req.user.id,
        cleanServiceName,
        cleanSubject,
        cleanMessage,
        category,
        priority
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'query_created',
      eventType: 'query_created',
      severity: 'low',
      status: 'success',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      metadata: { category }
    });

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

async function getMyQueries(req, res, next) {
  try {
    const result = await pool.query(
      `
        SELECT
          *,
          updated_at AS last_updated
        FROM queries
        WHERE user_id = $1
        ORDER BY updated_at DESC
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

async function getQueryById(req, res, next) {
  try {
    const result = await pool.query(
        `
        SELECT * FROM queries
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
        [req.params.id, req.user.id] // ✅ FIX
    );

    if (!result.rowCount) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
        errorCode: 'FORBIDDEN'
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

async function getAllQueries(req, res, next) {
  try {
    const result = await pool.query(
      `
        SELECT * FROM queries
        ORDER BY created_at DESC
      `
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `
        UPDATE queries
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Query not found',
        errorCode: 'NOT_FOUND'
      });
    }

    await logAudit({
      userId: req.user.id,
      action: 'admin_action',
      eventType: 'admin_action',
      severity: 'medium',
      status: 'success',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      metadata: { queryId: id, newStatus: status }
    });

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

async function replyToQuery(req, res, next) {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const cleanReply = sanitizeText(reply);

    const result = await pool.query(
      `
        UPDATE queries
        SET admin_reply = $1,
            replied_by = $2,
            replied_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [cleanReply, req.user.id, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Query not found',
        errorCode: 'NOT_FOUND'
      });
    }

    await logAudit({
      userId: req.user.id,
      action: 'admin_action',
      eventType: 'admin_action',
      severity: 'medium',
      status: 'success',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      metadata: { queryId: id, action: 'reply_added' }
    });

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createQuery,
  getMyQueries,
  getQueryById,
  getAllQueries,
  updateStatus,
  replyToQuery
};
