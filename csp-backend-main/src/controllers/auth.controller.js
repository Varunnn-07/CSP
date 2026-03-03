const authService = require('../services/auth.service');

/*
  SECURITY PRINCIPLES:
  - Never leak whether user exists
  - Normalize email input
  - Reject malformed requests early
  - Do not expose internal errors
  - Maintain consistent error responses
*/

/*
  STEP 1: Email + Password → OTP
*/
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Basic defensive validation (even if Joi is used)
    if (
      !email ||
      !password ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request format",
        errorCode: "INVALID_REQUEST"
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    const result = await authService.login(
      normalizedEmail,
      password,
      req.ip,
      req.headers['user-agent']
    );

    // Do NOT reveal internal state differences
    return res
      .status(result.success ? 200 : 401)
      .json(result);

  } catch (err) {
    // Never leak internal error details
    next(err);
  }
}


/*
  STEP 2: OTP Verification → JWT
*/
async function verifyOtp(req, res, next) {
  try {
    const { userId, otp } = req.body;

    if (
      !userId ||
      !otp ||
      typeof userId !== 'string' ||
      typeof otp !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request format",
        errorCode: "INVALID_REQUEST"
      });
    }

    // Strict format enforcement
    if (!/^[0-9]{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP format",
        errorCode: "INVALID_OTP_FORMAT"
      });
    }

    const result = await authService.verifyOtp(
      userId,
      otp,
      req.ip,
      req.headers['user-agent']
    );

    return res
      .status(result.success ? 200 : 401)
      .json(result);

  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  verifyOtp
};
