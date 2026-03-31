const { logAudit } = require('../utils/auditLogger');
const { getClientIp } = require('../security/clientIp');

function authorize({ roles = [], ownershipCheck = null } = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errorCode: 'AUTH_REQUIRED'
        });
      }

      if (!roles.length) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errorCode: 'ACCESS_DENIED'
        });
      }

      if (!roles.includes(req.user.role)) {
        try {
          await logAudit({
            userId: req.user.id,
            action: 'permission_denied',
            eventType: 'permission_denied',
            severity: 'medium',
            status: 'failure',
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
            metadata: {
              role: req.user.role,
              path: req.originalUrl,
              method: req.method,
              requiredRoles: roles
            }
          });
        } catch (error) {
          console.error('Audit log failed:', error.message);
        }

        return res.status(403).json({
          success: false,
          message: 'Forbidden',
          errorCode: 'FORBIDDEN'
        });
        return res.status(403).json({
          success: false,
          message: 'Forbidden',
          errorCode: 'FORBIDDEN'
        });
      }

      if (typeof ownershipCheck === 'function' && req.user.role !== 'admin') {
        const isOwner = await ownershipCheck(req);

        if (!isOwner) {
          try {
            await logAudit({
              userId: req.user.id,
              action: 'permission_denied',
              eventType: 'permission_denied',
              severity: 'high',
              status: 'failure',
              ip: getClientIp(req),
              userAgent: req.headers['user-agent'],
              requestId: req.requestId,
              metadata: {
                reason: 'ownership_mismatch',
                path: req.originalUrl,
                method: req.method
              }
            });
          } catch (error) {
            console.error('Audit log failed:', error.message);
          }

          return res.status(403).json({
            success: false,
            message: 'Forbidden',
            errorCode: 'FORBIDDEN'
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = authorize;
