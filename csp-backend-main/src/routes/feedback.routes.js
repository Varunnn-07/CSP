const express = require('express');
const { z } = require('zod');

const authenticateJWT = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorize.middleware');
const validate = require('../middleware/validation.middleware');
const { sanitizeFields } = require('../middleware/sanitize.middleware');

const ROLES = require('../constants/roles');
const feedbackController = require('../controllers/feedback.controller');
const { feedbackOwnerByParam } = require('../security/ownership');
const { feedbackLimiter } = require('../security/rateLimiters');

const { createFeedbackSchema } = require('../constants/feedback.validation');

const idParamSchema = z.object({ id: z.string().uuid() }).strict();

const router = express.Router();

router.use(feedbackLimiter);

router.post(
  '/',
  authenticateJWT,
  authorize({ roles: [ROLES.USER, ROLES.ADMIN] }),
  validate(createFeedbackSchema),
  sanitizeFields(['service_name', 'message']),
  feedbackController.createFeedback
);

router.get(
  '/',
  authenticateJWT,
  authorize({ roles: [ROLES.USER, ROLES.ADMIN] }),
  feedbackController.getMyFeedback
);

router.get(
  '/my',
  authenticateJWT,
  authorize({ roles: [ROLES.USER, ROLES.ADMIN] }),
  feedbackController.getMyFeedback
);

router.get(
  '/:id',
  authenticateJWT,
  validate(idParamSchema, 'params'),
  authorize({ roles: [ROLES.USER, ROLES.ADMIN], ownershipCheck: feedbackOwnerByParam('id') }),
  feedbackController.getFeedbackById
);

module.exports = router;
