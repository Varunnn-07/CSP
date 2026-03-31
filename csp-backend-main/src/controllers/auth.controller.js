const authService = require('../services/auth.service');
const { getClientIp } = require('../security/clientIp');
const {
  clearPreAuthCookie,
  clearSessionCookies,
  getPreAuthTokenCookie,
  getRefreshTokenCookie,
  setPreAuthCookie,
  setSessionCookies
} = require('../security/authCookies');

function buildRequestContext(req) {
  return {
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    requestId: req.requestId
  };
}

function authStatusCode(result) {
  if (result.success) {
    return 200;
  }

  if (['ACCOUNT_LOCKED', 'MFA_NOT_CONFIGURED'].includes(result.errorCode)) {
    return 423;
  }

  if (['OTP_LOCKED'].includes(result.errorCode)) {
    return 429;
  }

  if (['ACCOUNT_LOCKED_MANUAL', 'ACCOUNT_LOCKED_TEMP'].includes(result.errorCode)) {
    return 403;
  }

  if (['MFA_SETUP_EXPIRED', 'OTP_INVALID', 'MFA_ALREADY_ENABLED'].includes(result.errorCode)) {
    return 400;
  }

  return 401;
}

function normalizeLoginResponse(result) {
  if (!result || !result.success) {
    return result;
  }

  const requiresOtp = !!(result.requireOtp || result.mfa_required);
  const requiresSetup = !!(result.mfaSetupRequired || result.mfa_setup_required);
  const normalized = { ...result };

  if (requiresOtp) {
    normalized.requireOtp = true;
    normalized.mfa_required = true;
    normalized.mfaSetupRequired = false;
    normalized.mfa_setup_required = false;
    normalized.message = normalized.message || 'TOTP_REQUIRED';
  } else if (requiresSetup) {
    normalized.mfaSetupRequired = true;
    normalized.mfa_setup_required = true;
    normalized.requireOtp = false;
    normalized.mfa_required = false;
  } else {
    normalized.mfa_required = false;
  }

  if (normalized.token && !normalized.accessToken) {
    normalized.accessToken = normalized.token;
  }

  return normalized;
}

function normalizeVerifyResponse(result) {
  if (!result || !result.success) {
    return result;
  }

  if (result.token && !result.accessToken) {
    return {
      ...result,
      accessToken: result.token
    };
  }

  return result;
}

const AUTH_COOKIE_ENABLED = String(
  process.env.AUTH_COOKIE_ENABLED || 'true'
).toLowerCase() !== 'false';

function logCookieUsage(req, kind, details = {}) {
  console.info('auth-cookie', {
    kind,
    requestId: req.requestId || null,
    ...details
  });
}

function applySessionCookies(req, res, payload) {
  if (!AUTH_COOKIE_ENABLED) {
    return;
  }

  if (payload?.accessToken || payload?.refreshToken) {
    setSessionCookies(res, payload);
    logCookieUsage(req, 'session_applied', {
      hasAccessToken: !!payload.accessToken,
      hasRefreshToken: !!payload.refreshToken
    });
  }
}

function applyPreAuthCookie(req, res, payload) {
  if (!AUTH_COOKIE_ENABLED) {
    return;
  }

  if (payload?.preAuthToken) {
    setPreAuthCookie(res, payload.preAuthToken);
    logCookieUsage(req, 'preauth_applied', {
      hasPreAuthToken: true
    });
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, buildRequestContext(req));
    const normalized = normalizeLoginResponse(result);

    applyPreAuthCookie(req, res, normalized);
    applySessionCookies(req, res, normalized);

    return res.status(authStatusCode(normalized)).json(normalized);
  } catch (error) {
    return next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { userId, otp } = req.body;
    const preAuthToken = req.body.preAuthToken || getPreAuthTokenCookie(req);
    const result = await authService.verifyOtp(userId, otp, buildRequestContext(req), preAuthToken);
    const normalized = normalizeVerifyResponse(result);

    if (normalized.success) {
      applySessionCookies(req, res, normalized);
      clearPreAuthCookie(res);
    }

    return res.status(authStatusCode(normalized)).json(normalized);
  } catch (error) {
    return next(error);
  }
}

async function verifyTotp(req, res, next) {
  try {
    const userId = req.body.userId;
    const token = String(req.body.token || req.body.otp || '').trim();
    const preAuthToken = req.body.preAuthToken || getPreAuthTokenCookie(req);
    const result = await authService.verifyOtp(userId, token, buildRequestContext(req), preAuthToken);
    const normalized = normalizeVerifyResponse(result);

    if (normalized.success) {
      applySessionCookies(req, res, normalized);
      clearPreAuthCookie(res);
    }

    return res.status(authStatusCode(normalized)).json(normalized);
  } catch (error) {
    return next(error);
  }
}

async function activateMfa(req, res, next) {
  try {
    const userId = req.body.userId;
    const token = String(req.body.token || req.body.otp || '').trim();
    const preAuthToken = req.body.preAuthToken || getPreAuthTokenCookie(req);
    const result = await authService.activateMfa(userId, token, buildRequestContext(req), preAuthToken);
    const normalized = normalizeVerifyResponse(result);

    if (normalized.success) {
      applySessionCookies(req, res, normalized);
      clearPreAuthCookie(res);
    }

    return res.status(authStatusCode(normalized)).json(normalized);
  } catch (error) {
    return next(error);
  }
}

async function setupMfa(req, res, next) {
  try {
    const { userId } = req.body;
    const preAuthToken = req.body.preAuthToken || getPreAuthTokenCookie(req);
    const result = await authService.setupMfa(userId, buildRequestContext(req), preAuthToken);

    applyPreAuthCookie(req, res, result);

    return res.status(authStatusCode(result)).json(result);
  } catch (error) {
    return next(error);
  }
}

async function verifyMfaSetup(req, res, next) {
  try {
    const userId = req.body.userId;
    const token = String(req.body.token || req.body.otp || '').trim();
    const preAuthToken = req.body.preAuthToken || getPreAuthTokenCookie(req);
    const result = await authService.verifyMfaSetup(userId, token, buildRequestContext(req), preAuthToken);

    if (result.success) {
      applySessionCookies(req, res, result);
      clearPreAuthCookie(res);
    }

    return res.status(authStatusCode(result)).json(result);
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken || getRefreshTokenCookie(req);
    const result = await authService.refreshSession(refreshToken, buildRequestContext(req));
    const normalized = normalizeVerifyResponse(result);

    if (normalized.success) {
      applySessionCookies(req, res, normalized);
    } else {
      clearSessionCookies(res);
    }

    return res.status(authStatusCode(normalized)).json(normalized);
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken || getRefreshTokenCookie(req);
    const result = await authService.logoutSession(refreshToken, buildRequestContext(req));

    clearPreAuthCookie(res);
    clearSessionCookies(res);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  setupMfa,
  verifyMfaSetup,
  verifyOtp,
  verifyTotp,
  activateMfa,
  refresh,
  logout
};
