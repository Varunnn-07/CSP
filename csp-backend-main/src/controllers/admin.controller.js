const pool = require('../config/db');
const { getClientIp } = require('../security/clientIp');
const auditLogger = require('../utils/auditLogger');

async function dashboard(req, res, next) {
  try {
    return res.json({ success: true, message: 'Admin access granted' });
  } catch (error) {
    next(error);
  }
}

async function getSecurityEvents(req, res, next) {
  try {
    const auditQuery = `
      SELECT
        id,
        user_id,
        action,
        event_type,
        severity,
        status,
        ip,
        user_agent,
        request_id,
        metadata,
        event_timestamp
      FROM audit_logs
      ORDER BY event_timestamp DESC
      LIMIT 100
    `;

    const fallbackAuditQuery = `
      SELECT
        id,
        user_id,
        action,
        action AS event_type,
        'low'::text AS severity,
        status,
        ip_address::text AS ip,
        user_agent,
        NULL::uuid AS request_id,
        metadata,
        created_at AS event_timestamp
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const failedAttemptsQuery = `
      SELECT
        ip::text AS ip,
        COUNT(*)::int AS failed_count,
        MAX(event_timestamp) AS last_failed_at
      FROM audit_logs
      WHERE event_type IN ('LOGIN_FAILED', 'login_password_failed')
        AND status = 'failure'
        AND event_timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY ip
      ORDER BY failed_count DESC, last_failed_at DESC
      LIMIT 100
    `;

    const fallbackFailedAttemptsQuery = `
      SELECT
        ip_address::text AS ip,
        COUNT(*)::int AS failed_count,
        MAX(created_at) AS last_failed_at
      FROM audit_logs
      WHERE action IN ('LOGIN_FAILED', 'login_password_failed')
        AND status = 'failure'
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY ip_address
      ORDER BY failed_count DESC, last_failed_at DESC
      LIMIT 100
    `;

    let auditResult;
    let failedAttemptsResult;
    let blockedIpsResult;

    try {
      [auditResult, failedAttemptsResult, blockedIpsResult] = await Promise.all([
        pool.query(auditQuery),
        pool.query(failedAttemptsQuery),
        pool.query(
          `
            SELECT
              id,
              ip_address::text AS ip,
              blocked_until,
              reason,
              created_at
            FROM blocked_ips
            WHERE blocked_until > NOW()
            ORDER BY blocked_until DESC
            LIMIT 100
          `
        )
      ]);
    } catch (error) {
      if (!['42703', '42P01'].includes(error.code)) {
        throw error;
      }

      [auditResult, failedAttemptsResult] = await Promise.all([
        pool.query(fallbackAuditQuery),
        pool.query(fallbackFailedAttemptsQuery)
      ]);

      blockedIpsResult = { rows: [] };
    }

    return res.json({
      success: true,
      data: {
        recentAuditLogs: auditResult.rows,
        failedLoginAttempts: failedAttemptsResult.rows,
        blockedIps: blockedIpsResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
}

async function unlockUser(req, res, next) {
  const client = await pool.connect();

  try {
    const { email, userId } = req.body;

    await client.query('BEGIN');

    const lookupResult = email
      ? await client.query(
          `
            SELECT id, email
            FROM users
            WHERE lower(email) = lower($1)
            LIMIT 1
          `,
          [email]
        )
      : await client.query(
          `
            SELECT id, email
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [userId]
        );

    if (!lookupResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const user = lookupResult.rows[0];

    await client.query(
      `
        INSERT INTO user_security (
          user_id,
          failed_login_attempts,
          failed_otp_attempts,
          account_locked,
          otp_locked_until,
          mfa_enabled
        )
        VALUES ($1, 0, 0, FALSE, NULL, FALSE)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [user.id]
    );

    await client.query(
      `
        UPDATE user_security
        SET account_locked = FALSE,
            failed_login_attempts = 0
        WHERE user_id = $1
      `,
      [user.id]
    );

    await client.query(
      `
        UPDATE users
        SET is_active = TRUE
        WHERE id = $1
      `,
      [user.id]
    );

    await auditLogger.log({
      db: client,
      userId: req.user?.id || null,
      action: 'unlock_user',
      eventType: 'unlock_user',
      severity: 'medium',
      status: 'success',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      metadata: {
        unlockedUserId: user.id,
        unlockedEmail: user.email
      }
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'User unlocked successfully',
      data: {
        userId: user.id,
        email: user.email
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

module.exports = {
  dashboard,
  getSecurityEvents,
  unlockUser
};
