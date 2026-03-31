const pool = require('../config/db');

function queryOwnerByParam(paramName = 'id') {
  return async (req) => {
    const resourceId = req.params[paramName];
    if (!resourceId) {
      return false;
    }

    const result = await pool.query(
      'SELECT user_id FROM queries WHERE id = $1 LIMIT 1',
      [resourceId]
    );

    if (!result.rowCount) {
      return false;
    }

    return result.rows[0].user_id === req.user.id;
  };
}

function feedbackOwnerByParam(paramName = 'id') {
  return async (req) => {
    const resourceId = req.params[paramName];
    if (!resourceId) {
      return false;
    }

    const result = await pool.query(
      'SELECT user_id FROM feedback WHERE id = $1 LIMIT 1',
      [resourceId]
    );

    if (!result.rowCount) {
      return false;
    }

    return result.rows[0].user_id === req.user.id;
  };
}

module.exports = {
  queryOwnerByParam,
  feedbackOwnerByParam
};
