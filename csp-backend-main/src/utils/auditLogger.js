async function logAudit(pool, userId, action, status, ip, userAgent, metadata = {}) {
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, status, ip_address, user_agent, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      action,
      status,
      ip,
      userAgent,
      metadata
    ]);
  }
  
  module.exports = {
    logAudit
  };