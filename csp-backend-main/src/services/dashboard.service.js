const pool = require("../config/db");

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getDashboardFullData(userId) {
  const userInfoQuery = `
    SELECT
      u.email,
      ui.name,
      ui.phone,
      ui.company_name,
      ui.country,
      sp.plan_name,
      sp.storage_limit_gb,
      sp.daily_limit_gb,
      sp.api_limit_per_day,
      sp.data_transfer_limit_gb
    FROM users u
    JOIN users_info ui ON ui.user_id = u.id
    LEFT JOIN subscription_plans sp ON sp.id = ui.plan_id
    WHERE u.id = $1
    LIMIT 1
  `;

  const queriesQuery = `
    SELECT
      id,
      subject,
      status,
      updated_at AS "lastUpdated"
    FROM queries
    WHERE user_id = $1
    ORDER BY updated_at DESC
  `;

  const queryStatsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
      COUNT(*)::int AS total
    FROM queries
    WHERE user_id = $1
  `;

  const feedbackQuery = `
    SELECT
      message,
      service_name AS "serviceName",
      rating,
      created_at AS "createdAt"
    FROM feedback
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;

  const usageQuery = `
    SELECT *
    FROM cloud_usage
    WHERE user_id = $1
    ORDER BY usage_date ASC
  `;

  const [
    userInfoResult,
    queriesResult,
    queryStatsResult,
    feedbackResult,
    usageResult
  ] = await Promise.all([
    pool.query(userInfoQuery, [userId]),
    pool.query(queriesQuery, [userId]),
    pool.query(queryStatsQuery, [userId]),
    pool.query(feedbackQuery, [userId]),
    pool.query(usageQuery, [userId])
  ]);

  if (!userInfoResult.rows.length) {
    throw new Error("Dashboard profile not found for user");
  }

  const user = userInfoResult.rows[0];
  const usageRows = usageResult.rows;
  const latestUsage = usageRows[usageRows.length - 1] || null;
  const stats = queryStatsResult.rows[0] || { resolved: 0, total: 0 };

  return {
    user: {
      name: user.name,
      email: user.email,
      plan: user.plan_name || "Starter",
      phone: user.phone,
      companyName: user.company_name,
      country: user.country
    },
    stats: {
      resolvedQueriesCount: toNumber(stats.resolved),
      feedbackCount: feedbackResult.rows.length,
      totalQueries: toNumber(stats.total)
    },
    usage: {
      currentUsageGB: toNumber(latestUsage?.current_usage_gb ?? latestUsage?.storage_used_gb),
      usagePercentage: toNumber(latestUsage?.usage_percentage),
      dailyLimit: toNumber(latestUsage?.daily_limit_gb ?? user.daily_limit_gb),
      apiRequestsToday: toNumber(latestUsage?.api_requests_today),
      dataTransferToday: toNumber(latestUsage?.data_transfer_today_gb),
      storageLimitGB: toNumber(user.storage_limit_gb),
      apiLimitPerDay: toNumber(user.api_limit_per_day),
      dataTransferLimitGB: toNumber(user.data_transfer_limit_gb),
      history: usageRows.map((row) => ({
        usage_date: row.usage_date,
        storage_used_gb: toNumber(row.storage_used_gb)
      }))
    },
    queries: queriesResult.rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      status: row.status,
      lastUpdated: row.lastUpdated
    })),
    feedback: feedbackResult.rows.map((row) => ({
      message: row.message,
      createdAt: row.createdAt,
      serviceName: row.serviceName,
      rating: toNumber(row.rating)
    }))
  };
}

module.exports = {
  getDashboardFullData
};
