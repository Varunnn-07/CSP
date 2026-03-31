const rateLimit = require('express-rate-limit');

function jsonLimiter(message, errorCode, windowMs, max, extraOptions = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    ...extraOptions,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        errorCode
      });
    }
  });
}

const loginLimiter = jsonLimiter(
  'Too many login attempts. Please try again later.',
  'RATE_LIMITED_LOGIN',
  60 * 1000,
  5
);

const otpLimiter = jsonLimiter(
  'Too many OTP attempts. Please try again later.',
  'RATE_LIMITED_OTP',
  60 * 1000,
  5
);

// Added: stricter auth throttles only for the highest-risk endpoints.
const strictLoginLimiter = jsonLimiter(
  'Too many login attempts. Please try again later.',
  'RATE_LIMITED_LOGIN',
  5 * 60 * 1000,
  5,
  { skipSuccessfulRequests: true }
);

const strictTotpLimiter = jsonLimiter(
  'Too many OTP attempts. Please try again later.',
  'RATE_LIMITED_TOTP',
  5 * 60 * 1000,
  5,
  { skipSuccessfulRequests: true }
);

const queryLimiter = jsonLimiter(
  'Too many query requests. Please slow down.',
  'RATE_LIMITED_QUERY',
  60 * 1000,
  30
);

const feedbackLimiter = jsonLimiter(
  'Too many feedback requests. Please slow down.',
  'RATE_LIMITED_FEEDBACK',
  60 * 1000,
  20
);

module.exports = {
  loginLimiter,
  otpLimiter,
  strictLoginLimiter,
  strictTotpLimiter,
  queryLimiter,
  feedbackLimiter
};
