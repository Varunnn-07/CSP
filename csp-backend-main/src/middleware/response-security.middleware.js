const AUTH_ERROR_CODES = new Set([
  'INVALID_CREDENTIALS',
  'AUTH_REQUIRED',
  'INVALID_TOKEN',
  'EMAIL_NOT_VERIFIED',
  'MFA_NOT_CONFIGURED',
  'INVALID_PREAUTH',
  'PREAUTH_REQUIRED',
  'INVALID_REFRESH_TOKEN',
  'OTP_INVALID'
]);

const PASSTHROUGH_ERROR_CODES = new Set([
  'ACCOUNT_LOCKED',
  'OTP_LOCKED',
  'IP_BLOCKED'
]);

// Added: strip detailed error fields and normalize all error messages before they reach the frontend.
function secureErrorResponses(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === 'object' && (res.statusCode >= 400 || body.success === false)) {
      const sanitized = { ...body };

      delete sanitized.details;
      delete sanitized.error;
      delete sanitized.errors;
      delete sanitized.stack;

      sanitized.message = PASSTHROUGH_ERROR_CODES.has(sanitized.errorCode)
        ? sanitized.message
        : AUTH_ERROR_CODES.has(sanitized.errorCode)
          ? 'Invalid credentials'
          : 'Request failed';

      return originalJson(sanitized);
    }

    return originalJson(body);
  };

  return next();
}

module.exports = secureErrorResponses;
