async function getActiveBlockRecord(db, ip) {
  try {
    const result = await db.query(
        `
        SELECT id, ip_address, blocked_until, reason
        FROM blocked_ips
        WHERE ip_address = $1
          AND blocked_until > NOW()
        ORDER BY blocked_until DESC
        LIMIT 1
      `,
        [ip]
    );

    return result.rows[0] || null;
  } catch (error) {
    if (error.code === '42P01') {
      return null;
    }
    throw error;
  }
}

async function addIpBlock(db, ip, reason, durationMinutes = 30) {
  try {
    const result = await db.query(
        `
        INSERT INTO blocked_ips (ip_address, created_at, blocked_until, reason)
        VALUES (
          $1,
          NOW(),
          NOW() + ($2 * INTERVAL '1 minute'),
          $3
        )
        ON CONFLICT (ip_address) DO UPDATE
        SET blocked_until = GREATEST(
              blocked_ips.blocked_until,
              EXCLUDED.blocked_until
            ),
            reason = EXCLUDED.reason
        RETURNING *
      `,
        [ip, durationMinutes, reason]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '42P01') {
      return null;
    }
    throw error;
  }
}

module.exports = {
  getActiveBlockRecord,
  addIpBlock
};
