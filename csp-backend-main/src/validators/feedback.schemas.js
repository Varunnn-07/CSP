const { z } = require('zod');

const createFeedbackSchema = z.object({
  service_name: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(5000),
  rating: z.number().int().min(1).max(5)
}).strict();

module.exports = {
  createFeedbackSchema
};
