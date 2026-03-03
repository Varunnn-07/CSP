const Joi = require('joi');

exports.createFeedbackSchema = Joi.object({
  service_name: Joi.string().max(100).required(),
  message: Joi.string().max(5000).required(),
  rating: Joi.number().integer().min(1).max(5).required()
});