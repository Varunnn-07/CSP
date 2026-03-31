const express = require('express');
const { z } = require('zod');
const authenticateJWT = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorize.middleware');
const validate = require('../middleware/validation.middleware');
const { sanitizeFields } = require('../middleware/sanitize.middleware');
const ROLES = require('../constants/roles');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

const unlockUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  userId: z.string().uuid().optional()
}).strict().refine((payload) => !!(payload.email || payload.userId), {
  message: 'email or userId is required'
});

router.get(
  '/dashboard',
  authenticateJWT,
  authorize({ roles: [ROLES.ADMIN] }),
  adminController.dashboard
);

router.get(
  '/security/events',
  authenticateJWT,
  authorize({ roles: [ROLES.ADMIN] }),
  adminController.getSecurityEvents
);

router.post(
  '/unlock-user',
  authenticateJWT,
  authorize({ roles: [ROLES.ADMIN] }),
  validate(unlockUserSchema),
  sanitizeFields(['email']),
  adminController.unlockUser
);

module.exports = router;
