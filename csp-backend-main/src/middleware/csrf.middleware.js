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

function shouldUseCrossSiteCookie(req) {
  const origin = String(req.get('origin') || '').trim().toLowerCase();
  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const configuredOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const hasHostedFrontend = configuredOrigins.some((value) =>
    value.startsWith('https://')
    && !value.includes('localhost')
    && !value.includes('127.0.0.1')
  );

  if (origin && configuredOrigins.includes(origin) && origin.startsWith('https://')) {
    return true;
  }

  if (forwardedProto === 'https') {
    return true;
  }

  return hasHostedFrontend;
}

function buildCsrfCookieOptions(req) {
  const useCrossSiteCookie = shouldUseCrossSiteCookie(req);

  return {
    httpOnly: true,
    secure: useCrossSiteCookie,
    sameSite: useCrossSiteCookie ? 'none' : 'strict',
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
    res.cookie(CSRF_COOKIE_NAME, secret, buildCsrfCookieOptions(req));
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
