const express = require('express');
const router = express.Router();

const authenticateJWT = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const validate = require('../middleware/validation.middleware');

const ROLES = require('../constants/roles');
const feedbackController = require('../controllers/feedback.controller');

const { createFeedbackSchema } = require('../constants/feedback.validation');

router.post(
  '/',
  authenticateJWT,
  requireRole(ROLES.USER, ROLES.ADMIN),
  validate(createFeedbackSchema),
  feedbackController.createFeedback
);

router.get(
  '/my',
  authenticateJWT,
  requireRole(ROLES.USER, ROLES.ADMIN),
  feedbackController.getMyFeedback
);

module.exports = router;