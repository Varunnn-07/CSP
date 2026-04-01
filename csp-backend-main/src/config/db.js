const { Pool } = require("pg");
const { getRequestDbClient } = require("./dbContext");

/* ------------------------------------------------ */
/* DATABASE CONFIG */
/* ------------------------------------------------ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 2000),

  // ✅ Required for Neon
  ssl: {
    rejectUnauthorized: false
  },

  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 10000),
  query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS || 10000)
});

/* ------------------------------------------------ */
/* SAVE ORIGINAL QUERY (CRITICAL FIX) */
/* ------------------------------------------------ */

const originalPoolQuery = pool.query.bind(pool);

pool.query = async (...args) => {
  const requestClient = getRequestDbClient();

  try {
    const userId = requestClient?.userId || null;

    if (requestClient && userId) {
      await requestClient.query(`SET app.user_id = '${userId}'`);
      return await requestClient.query(...args);
    }

    // ✅ Use ORIGINAL query (prevents recursion)
    return await originalPoolQuery(...args);

  } catch (err) {
    console.error("Database query error:", err);
    throw err;
  }
};

/* ------------------------------------------------ */
/* ERROR HANDLING */
/* ------------------------------------------------ */

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
  process.exit(1);
});

/* ------------------------------------------------ */
/* CONNECTION TEST */
/* ------------------------------------------------ */

async function testConnection() {
  try {
    await originalPoolQuery("SELECT 1"); // ✅ use original (avoid recursion)
    console.log("✅ Connected to Neon DB");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
}

testConnection();

/* ------------------------------------------------ */

module.exports = pool;