const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(100)
}).strict();

const otpSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().regex(/^[0-9]{6}$/),
  preAuthToken: z.string().min(20).optional()
}).strict();

const mfaSetupSchema = z.object({
  userId: z.string().uuid(),
  preAuthToken: z.string().min(20).optional()
}).strict();

const mfaSetupVerifySchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().regex(/^[0-9]{6}$/),
  preAuthToken: z.string().min(20).optional()
}).strict();

module.exports = {
  loginSchema,
  otpSchema,
  mfaSetupSchema,
  mfaSetupVerifySchema
};
