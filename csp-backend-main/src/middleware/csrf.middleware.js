const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'csp_csrf_secret';
const CSRF_HEADER_NAME = 'x-csrf-token';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT_PATH_PREFIXES = ['/api/auth/'];

function parseCookies(cookieHeader = '') {
  const cookies = {};

  for (const part of String(cookieHeader).split(';')) {
    const [rawName, ...rawValue] = part.split('=');
    const name = String(rawName || '').trim();

    if (!name) {
      continue;
    }

    cookies[name] = decodeURIComponent(rawValue.join('=').trim());
  }

  return cookies;
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function buildCsrfCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/'
  };
}

function createToken(secret) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'csp-csrf')
    .update(secret)
    .digest('hex');
}

function isSafeToken(secret) {
  return typeof secret === 'string' && /^[a-f0-9]{64}$/i.test(secret);
}

function isExemptPath(pathname = '') {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function tokensMatch(expected, received) {
  if (typeof received !== 'string' || expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

// Added: issue an HttpOnly CSRF secret cookie and validate the returned header on unsafe requests.
function csrfProtection(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let secret = cookies[CSRF_COOKIE_NAME];

  if (!isSafeToken(secret)) {
    secret = generateSecret();
    res.cookie(CSRF_COOKIE_NAME, secret, buildCsrfCookieOptions());
  }

  const csrfToken = createToken(secret);
  res.setHeader('X-CSRF-Token', csrfToken);
  res.locals.csrf = {
    enabled: true,
    token: csrfToken
  };

  if (!STATE_CHANGING_METHODS.has(req.method) || isExemptPath(req.path)) {
    return next();
  }

  const providedToken = req.get(CSRF_HEADER_NAME);

  if (tokensMatch(csrfToken, providedToken)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Request failed',
    errorCode: 'CSRF_INVALID'
  });
}

module.exports = {
  csrfProtection,
  CSRF_HEADER_NAME
};
