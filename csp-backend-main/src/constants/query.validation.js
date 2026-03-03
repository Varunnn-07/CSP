const Joi = require('joi');

const allowedCategories = [
  'Billing',
  'Technical',
  'Security',
  'Service',
  'General'
];

exports.createQuerySchema = Joi.object({
  service_name: Joi.string().max(100).required(),
  subject: Joi.string().max(255).required(),
  message: Joi.string().max(5000).required(),
  category: Joi.string().valid(...allowedCategories).required()
});

exports.updateStatusSchema = Joi.object({
  status: Joi.string().valid('Open', 'In Progress', 'Resolved').required()
});

exports.replySchema = Joi.object({
  reply: Joi.string().max(5000).required()
});