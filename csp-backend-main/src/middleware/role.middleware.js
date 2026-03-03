function requireRole(...allowedRoles) {
    if (!allowedRoles || allowedRoles.length === 0) {
      throw new Error('requireRole middleware must be configured with at least one role');
    }
  
    return (req, res, next) => {
  
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errorCode: 'AUTH_REQUIRED'
        });
      }
  
      if (!req.user.role || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden',
          errorCode: 'FORBIDDEN'
        });
      }
  
      next();
    };
  }
  
  module.exports = requireRole;