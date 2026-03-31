const pool = require('../config/db');
const { getActiveBlockRecord } = require('../security/ipBlock.service');
const { getClientIp } = require('../security/clientIp');
const { logAudit } = require('../utils/auditLogger');

async function blockedIpMiddleware(req, res, next) {
  try {
    const ip = getClientIp(req);

    const block = await getActiveBlockRecord(pool, ip);

    if (!block) {
      return next();
    }

    /* AUDIT LOGGING */

    try {
      await logAudit({
        userId: null,
        action: 'blocked_ip_access_attempt',
        eventType: 'ip_blocked',
        severity: 'high',
        status: 'failure',
        ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        requestId: req.requestId || null,
        metadata: {
          path: req.originalUrl,
          blockedUntil: block.blocked_until,
          reason: block.reason || 'Too many failed login attempts'
        }
      });
    } catch (auditError) {
      console.error('Audit log failed:', auditError.message);
    }

    // TEMP DISABLED (CRITICAL FIX)
    console.warn('BLOCKING DISABLED TEMPORARILY:', req.ip || ip, req.originalUrl);
    return next();

  } catch (error) {
    return next(error);
  }
}

module.exports = blockedIpMiddleware;
