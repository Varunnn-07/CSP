const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const ROLES = require('../constants/roles');

router.get(
  '/dashboard',
  authenticateJWT,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    res.json({ success: true, message: 'Admin access granted' });
  }
);

module.exports = router;