const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      errorCode: 'AUTH_REQUIRED'
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error',
      errorCode: 'SERVER_ERROR'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'csp-control-plane',
      algorithms: ['HS256']
    });

    if (!decoded.sub || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        errorCode: 'INVALID_TOKEN'
      });
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role
    };

    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      errorCode: 'INVALID_TOKEN'
    });
  }
}

module.exports = authenticateJWT;