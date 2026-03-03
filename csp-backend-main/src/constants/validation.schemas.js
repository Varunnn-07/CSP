const Joi = require('joi');

exports.loginSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(100).required()
});

exports.otpSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required()
});
