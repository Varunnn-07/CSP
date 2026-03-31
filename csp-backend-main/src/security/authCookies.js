const ACCESS_TOKEN_COOKIE = 'csp_access_token';
const REFRESH_TOKEN_COOKIE = 'csp_refresh_token';
const PRE_AUTH_TOKEN_COOKIE = 'csp_pre_auth_token';

const ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000;
const PRE_AUTH_TOKEN_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function readCookie(req, name) {
  return parseCookies(req?.headers?.cookie)[name] || '';
}

function buildCookieOptions({ maxAge, path = '/' } = {}) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path
  };

  if (Number.isFinite(maxAge)) {
    options.maxAge = maxAge;
  }

  return options;
}

function setSessionCookies(res, { accessToken, refreshToken }) {
  if (accessToken) {
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      buildCookieOptions({ maxAge: ACCESS_TOKEN_TTL_MS, path: '/' })
    );
  }

  if (refreshToken) {
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      buildCookieOptions({ maxAge: REFRESH_TOKEN_TTL_MS, path: '/api/auth' })
    );
  }
}

function setPreAuthCookie(res, preAuthToken) {
  if (!preAuthToken) {
    return;
  }

  res.cookie(
    PRE_AUTH_TOKEN_COOKIE,
    preAuthToken,
    buildCookieOptions({ maxAge: PRE_AUTH_TOKEN_TTL_MS, path: '/api/auth' })
  );
}

function clearSessionCookies(res) {
  res.clearCookie(
    ACCESS_TOKEN_COOKIE,
    buildCookieOptions({ path: '/' })
  );
  res.clearCookie(
    REFRESH_TOKEN_COOKIE,
    buildCookieOptions({ path: '/api/auth' })
  );
}

function clearPreAuthCookie(res) {
  res.clearCookie(
    PRE_AUTH_TOKEN_COOKIE,
    buildCookieOptions({ path: '/api/auth' })
  );
}

function getAccessTokenCookie(req) {
  return readCookie(req, ACCESS_TOKEN_COOKIE);
}

function getRefreshTokenCookie(req) {
  return readCookie(req, REFRESH_TOKEN_COOKIE);
}

function getPreAuthTokenCookie(req) {
  return readCookie(req, PRE_AUTH_TOKEN_COOKIE);
}

module.exports = {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  PRE_AUTH_TOKEN_COOKIE,
  clearPreAuthCookie,
  clearSessionCookies,
  getAccessTokenCookie,
  getPreAuthTokenCookie,
  getRefreshTokenCookie,
  parseCookies,
  setPreAuthCookie,
  setSessionCookies
};
