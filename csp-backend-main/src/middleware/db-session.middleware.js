const pool = require('../config/db');
const { runWithDbClient } = require('../config/dbContext');

const DB_SESSION_CONTEXT_ENABLED = String(
  process.env.DB_SESSION_CONTEXT_ENABLED || 'true'
).toLowerCase() !== 'false';

async function attachUserDbSession(req, res, next) {
  if (!DB_SESSION_CONTEXT_ENABLED) {
    return next();
  }

  if (!req.user?.id || req.user.role === 'admin') {
    return next();
  }

  let client;

  try {
    client = await pool.connect();
    await client.query(
      'SELECT set_config($1, $2, false)',
      ['app.user_id', String(req.user.id)]
    );
  } catch {
    if (client) {
      client.release();
    }

    return next();
  }

  req.db = client;

  let released = false;

  const cleanup = () => {
    if (released) {
      return;
    }

    released = true;

    client
      .query('RESET app.user_id')
      .catch(() => {})
      .finally(() => {
        client.release();
      });
  };

  res.once('finish', cleanup);
  res.once('close', cleanup);

  return runWithDbClient(client, () => next());
}

module.exports = attachUserDbSession;
