const authorize = require('./authorize.middleware');

function requireRole(...allowedRoles) {
  return authorize({ roles: allowedRoles });
}

module.exports = requireRole;
