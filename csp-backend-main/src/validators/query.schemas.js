const { z } = require('zod');

const allowedCategories = ['Billing', 'Technical', 'Security', 'Service', 'General'];
const allowedStatuses = ['Open', 'In Progress', 'Resolved'];

const createQuerySchema = z.object({
  service_name: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(5000),
  category: z.enum(allowedCategories)
}).strict();

const updateStatusSchema = z.object({
  status: z.enum(allowedStatuses)
}).strict();

const replySchema = z.object({
  reply: z.string().trim().min(1).max(5000)
}).strict();

module.exports = {
  createQuerySchema,
  updateStatusSchema,
  replySchema
};
