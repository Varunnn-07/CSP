const express = require('express');
const { z } = require('zod');

const authenticateJWT = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorize.middleware');
const validate = require('../middleware/validation.middleware');
const { sanitizeFields } = require('../middleware/sanitize.middleware');

const ROLES = require('../constants/roles');
const queryController = require('../controllers/query.controller');
const { queryOwnerByParam } = require('../security/ownership');
const { queryLimiter } = require('../security/rateLimiters');

const {
  createQuerySchema,
  updateStatusSchema,
  replySchema
} = require('../constants/query.validation');

const idParamSchema = z.object({ id: z.string().uuid() }).strict();

const router = express.Router();

router.use(queryLimiter);

router.post(
  '/',
  authenticateJWT,
  authorize({ roles: [ROLES.USER, ROLES.ADMIN] }),
  validate(createQuerySchema),
  sanitizeFields(['service_name', 'subject', 'message']),
  queryController.createQuery
);

router.get(
  '/',
  authenticateJWT,
  authorize({ roles: [ROLES.USER, ROLES.ADMIN] }),
  queryController.getMyQueries
);

router.get(
  '/my',
  authenticateJWT,
  authorize({ roles: [ROLES.USER, ROLES.ADMIN] }),
  queryController.getMyQueries
);

router.get(
  '/admin/all',
  authenticateJWT,
  authorize({ roles: [ROLES.ADMIN] }),
  queryController.getAllQueries
);

router.patch(
  '/admin/:id/status',
  authenticateJWT,
  validate(idParamSchema, 'params'),
  authorize({ roles: [ROLES.ADMIN] }),
  validate(updateStatusSchema),
  queryController.updateStatus
);

router.post(
  '/admin/:id/reply',
  authenticateJWT,
  validate(idParamSchema, 'params'),
  authorize({ roles: [ROLES.ADMIN] }),
  validate(replySchema),
  sanitizeFields(['reply']),
  queryController.replyToQuery
);

router.get(
  '/:id',
  authenticateJWT,
  validate(idParamSchema, 'params'),
  authorize({ roles: [ROLES.USER, ROLES.ADMIN], ownershipCheck: queryOwnerByParam('id') }),
  queryController.getQueryById
);

module.exports = router;
