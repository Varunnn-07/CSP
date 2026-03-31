const jwt = require('jsonwebtoken');
const attachUserDbSession = require('./db-session.middleware');
const { getAccessTokenCookie } = require('../security/authCookies');
const { TOKEN_ISSUER } = require('../security/token.service');

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: TOKEN_ISSUER,
    algorithms: ['HS256']
  });
}

function hasValidAccessPayload(decoded) {
  return !!(decoded?.sub && decoded?.role && decoded?.type === 'access');
}

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';
  const cookieToken = getAccessTokenCookie(req);

  if (!headerToken && !cookieToken) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      errorCode: 'AUTH_REQUIRED'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error',
      errorCode: 'SERVER_ERROR'
    });
  }

  const candidateTokens = [];

  if (headerToken) {
    candidateTokens.push(headerToken);
  }

  if (cookieToken && cookieToken !== headerToken) {
    candidateTokens.push(cookieToken);
  }

  for (const token of candidateTokens) {
    try {
      const decoded = verifyToken(token);

      if (!hasValidAccessPayload(decoded)) {
        continue;
      }

      req.user = {
        id: decoded.sub,
        role: decoded.role
      };

      return attachUserDbSession(req, res, next);
    } catch {
      // Ignore individual token failures so cookie fallback remains backward-compatible.
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid or expired token',
    errorCode: 'INVALID_TOKEN'
  });
}

module.exports = authenticateJWT;
