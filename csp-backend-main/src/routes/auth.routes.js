const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validation.middleware');
const { loginSchema, otpSchema } = require('../constants/validation.schemas');
const authController = require('../controllers/auth.controller');

const router = express.Router();

/*
  Login Rate Limiter
  Protects against password brute-force
*/
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts",
    errorCode: "RATE_LIMITED"
  }
});

/*
  OTP Rate Limiter
  Protects against OTP brute-force
*/
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP attempts",
    errorCode: "RATE_LIMITED"
  }
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/verify-otp', otpLimiter, validate(otpSchema), authController.verifyOtp);

module.exports = router;
