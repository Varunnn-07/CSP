const express = require('express');
const router = express.Router();

const authenticateJWT = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const validate = require('../middleware/validation.middleware');

const ROLES = require('../constants/roles');
const queryController = require('../controllers/query.controller');

const {
  createQuerySchema,
  updateStatusSchema,
  replySchema
} = require('../constants/query.validation');


/*
  USER ROUTES
*/

// Create query
router.post(
  '/',
  authenticateJWT,
  requireRole(ROLES.USER, ROLES.ADMIN),
  validate(createQuerySchema),
  queryController.createQuery
);

// Get own queries (anti-IDOR enforced in controller)
router.get(
  '/my',
  authenticateJWT,
  requireRole(ROLES.USER, ROLES.ADMIN),
  queryController.getMyQueries
);


/*
  ADMIN ROUTES
*/

// Get all queries
router.get(
  '/admin/all',
  authenticateJWT,
  requireRole(ROLES.ADMIN),
  queryController.getAllQueries
);

// Update query status
router.patch(
  '/admin/:id/status',
  authenticateJWT,
  requireRole(ROLES.ADMIN),
  validate(updateStatusSchema),
  queryController.updateStatus
);

// Reply to query
router.post(
  '/admin/:id/reply',
  authenticateJWT,
  requireRole(ROLES.ADMIN),
  validate(replySchema),
  queryController.replyToQuery
);


module.exports = router;