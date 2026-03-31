const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validation.middleware');
const { sanitizeFields } = require('../middleware/sanitize.middleware');
const blockedIpMiddleware = require('../middleware/blocked-ip.middleware');
const authController = require('../controllers/auth.controller');
const { loginSchema, otpSchema, mfaSetupSchema } = require('../constants/validation.schemas');
const {
  loginLimiter,
  otpLimiter,
  strictLoginLimiter,
  strictTotpLimiter
} = require('../security/rateLimiters');

const router = express.Router();

const totpVerifySchema = z.object({
  userId: z.string().uuid(),
  token: z.string().regex(/^[0-9]{6}$/).optional(),
  otp: z.string().regex(/^[0-9]{6}$/).optional(),
  preAuthToken: z.string().min(20).optional()
}).strict().refine((payload) => !!(payload.token || payload.otp), {
  message: 'token or otp is required'
});

router.post('/login', blockedIpMiddleware, loginLimiter, strictLoginLimiter, validate(loginSchema), sanitizeFields(['email']), authController.login);
router.post('/verify-otp', blockedIpMiddleware, otpLimiter, validate(otpSchema), authController.verifyOtp);
router.post('/verify-totp', blockedIpMiddleware, otpLimiter, strictTotpLimiter, validate(totpVerifySchema), authController.verifyTotp);
router.post('/mfa/setup', blockedIpMiddleware, loginLimiter, validate(mfaSetupSchema), authController.setupMfa);
router.post('/mfa/verify-setup', blockedIpMiddleware, otpLimiter, validate(totpVerifySchema), authController.verifyMfaSetup);
router.post('/mfa/verify', blockedIpMiddleware, otpLimiter, validate(totpVerifySchema), authController.verifyMfaSetup);
router.post('/mfa/activate', blockedIpMiddleware, otpLimiter, validate(totpVerifySchema), authController.activateMfa);
router.post('/refresh', blockedIpMiddleware, loginLimiter, authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
