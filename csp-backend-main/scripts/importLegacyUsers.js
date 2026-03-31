const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

const DEFAULT_TARGET_PLAN = "Starter";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

const PLAN_DEFAULTS = {
  Starter: {
    storage_limit_gb: 100,
    daily_limit_gb: 10,
    api_limit_per_day: 1000,
    data_transfer_limit_gb: 50
  },
  Growth: {
    storage_limit_gb: 250,
    daily_limit_gb: 25,
    api_limit_per_day: 3500,
    data_transfer_limit_gb: 180
  },
  Enterprise: {
    storage_limit_gb: 750,
    daily_limit_gb: 60,
    api_limit_per_day: 10000,
    data_transfer_limit_gb: 600
  }
};

const FALLBACK_QUERY_TEMPLATES = [
  {
    service_name: "Storage Gateway",
    subject_prefix: "Usage trend review",
    message_body: "Requesting a review of the current storage trend and projected growth for this account.",
    category: "Technical",
    priority: 2,
    status: "Open",
    days_ago: 1
  },
  {
    service_name: "Identity Manager",
    subject_prefix: "MFA onboarding confirmation",
    message_body: "Need confirmation that MFA onboarding completed correctly and recovery guidance is available.",
    category: "Security",
    priority: 3,
    status: "In Progress",
    days_ago: 3
  },
  {
    service_name: "Billing Console",
    subject_prefix: "Starter plan allowance clarification",
    message_body: "Need clarification on the current plan limits and expected overage behavior for this account.",
    category: "Billing",
    priority: 1,
    status: "Resolved",
    days_ago: 6
  }
];

const FALLBACK_FEEDBACK_TEMPLATES = [
  {
    service_name: "Dashboard",
    message_body: "The usage cards are clear and make daily monitoring straightforward.",
    rating: 5,
    days_ago: 2
  },
  {
    service_name: "Support Portal",
    message_body: "The authentication flow feels secure and the support sections are easy to follow.",
    rating: 4,
    days_ago: 7
  }
];

function parseArgs(argv) {
  return argv.reduce((result, entry) => {
    const trimmed = String(entry || "").trim();

    if (!trimmed.startsWith("--")) {
      return result;
    }

    const normalized = trimmed.slice(2);
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex === -1) {
      result[normalized] = true;
      return result;
    }

    const key = normalized.slice(0, separatorIndex);
    const value = normalized.slice(separatorIndex + 1);
    result[key] = value;
    return result;
  }, {});
}

function deriveLegacyDatabaseUrl(targetDatabaseUrl) {
  const explicitSourceUrl = process.env.LEGACY_DATABASE_URL || process.env.SOURCE_DATABASE_URL;

  if (explicitSourceUrl) {
    return explicitSourceUrl;
  }

  const url = new URL(targetDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

function toTitleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveDisplayName(email) {
  const localPart = String(email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim();

  return toTitleCase(localPart) || "Imported User";
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlanName(sourcePlanName) {
  const normalized = String(sourcePlanName || "").trim().toLowerCase();

  if (normalized === "enterprise") {
    return "Enterprise";
  }

  if (normalized === "growth" || normalized === "premium") {
    return "Growth";
  }

  if (normalized === "starter" || normalized === "free") {
    return "Starter";
  }

  return DEFAULT_TARGET_PLAN;
}

function getEmailHandle(email) {
  return String(email || "").split("@")[0] || "user";
}

async function ensureTargetPlan(targetClient, planName) {
  const normalizedPlanName = normalizePlanName(planName);
  const existingResult = await targetClient.query(
    `SELECT id, plan_name, storage_limit_gb, daily_limit_gb, api_limit_per_day, data_transfer_limit_gb
     FROM subscription_plans
     WHERE plan_name = $1
     LIMIT 1`,
    [normalizedPlanName]
  );

  if (existingResult.rows.length) {
    return existingResult.rows[0];
  }

  const defaults = PLAN_DEFAULTS[normalizedPlanName] || PLAN_DEFAULTS[DEFAULT_TARGET_PLAN];
  const insertedResult = await targetClient.query(
    `INSERT INTO subscription_plans (
       plan_name,
       storage_limit_gb,
       daily_limit_gb,
       api_limit_per_day,
       data_transfer_limit_gb
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, plan_name, storage_limit_gb, daily_limit_gb, api_limit_per_day, data_transfer_limit_gb`,
    [
      normalizedPlanName,
      defaults.storage_limit_gb,
      defaults.daily_limit_gb,
      defaults.api_limit_per_day,
      defaults.data_transfer_limit_gb
    ]
  );

  return insertedResult.rows[0];
}

async function fetchLegacyUsers(sourceClient, emailFilter) {
  const query = `
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.role,
      u.is_active,
      u.email_verified,
      u.created_at,
      u.updated_at,
      ui.full_name,
      ui.phone,
      ui.company_name,
      ui.country,
      sp.plan_name AS source_plan_name,
      us.failed_attempts,
      us.failed_login_attempts,
      us.account_locked_until,
      us.mfa_enabled,
      us.mfa_secret,
      us.last_login_at,
      us.last_login_ip,
      us.last_login_country,
      us.last_login_device,
      us.suspicious_login
    FROM users u
    LEFT JOIN users_info ui ON ui.user_id = u.id
    LEFT JOIN subscription_plans sp ON sp.id = ui.subscription_plan_id
    LEFT JOIN user_security us ON us.user_id = u.id
    WHERE ($1::text IS NULL OR lower(u.email) = lower($1))
    ORDER BY u.created_at ASC, u.email ASC
  `;

  const result = await sourceClient.query(query, [emailFilter || null]);
  return result.rows;
}

async function fetchLegacyQueries(sourceClient, sourceUserId) {
  const result = await sourceClient.query(
    `SELECT
       id,
       service_name,
       subject,
       message,
       category,
       priority,
       status,
       admin_reply,
       replied_by,
       replied_at,
       created_at,
       updated_at
     FROM queries
     WHERE user_id = $1
     ORDER BY created_at ASC, id ASC`,
    [sourceUserId]
  );

  return result.rows;
}

async function fetchLegacyFeedback(sourceClient, sourceUserId) {
  const result = await sourceClient.query(
    `SELECT
       id,
       service_name,
       message,
       rating,
       created_at,
       updated_at
     FROM feedback
     WHERE user_id = $1
     ORDER BY created_at ASC, id ASC`,
    [sourceUserId]
  );

  return result.rows;
}

async function fetchLegacyUsage(sourceClient, sourceUserId) {
  const result = await sourceClient.query(
    `SELECT DISTINCT ON (usage_date)
       id,
       usage_date,
       storage_used_gb,
       api_requests,
       data_transfer_gb,
       created_at
     FROM cloud_usage
     WHERE user_id = $1
     ORDER BY usage_date DESC, created_at DESC, id DESC`,
    [sourceUserId]
  );

  return result.rows;
}

async function getPrimaryAdminId(targetClient) {
  const result = await targetClient.query(
    `SELECT id
     FROM users
     WHERE role = 'admin'
     ORDER BY email ASC
     LIMIT 1`
  );

  return result.rows[0]?.id || null;
}

async function seedFallbackQueries(targetClient, userId, email, adminId) {
  const emailHandle = getEmailHandle(email);

  for (const template of FALLBACK_QUERY_TEMPLATES) {
    const subject = `${template.subject_prefix} - ${emailHandle}`;
    const message = `${template.message_body} User account: ${email}.`;
    const repliedAt = template.status === "Open"
      ? null
      : new Date(Date.now() - Math.max(template.days_ago - 1, 0) * 24 * 60 * 60 * 1000);
    const adminReply = template.status === "Open"
      ? null
      : template.status === "Resolved"
        ? "The request was reviewed and resolved by the support team."
        : "Support team is actively reviewing this request.";

    await targetClient.query(
      `INSERT INTO queries (
         user_id,
         service_name,
         subject,
         message,
         category,
         priority,
         status,
         admin_reply,
         replied_by,
         replied_at,
         created_at,
         updated_at
       )
       SELECT
         $1::uuid,
         $2::varchar,
         $3::varchar,
         $4::text,
         $5::varchar,
         $6::int,
         $7::varchar,
         $8::text,
         $9::uuid,
         $10::timestamptz,
         NOW() - make_interval(days => $11::int),
         NOW() - make_interval(days => GREATEST($11::int - 1, 0))
       WHERE NOT EXISTS (
         SELECT 1
         FROM queries
         WHERE user_id = $1::uuid
           AND subject = $3::varchar
       )`,
      [
        userId,
        template.service_name,
        subject,
        message,
        template.category,
        template.priority,
        template.status,
        adminReply,
        template.status === "Open" ? null : adminId,
        repliedAt,
        template.days_ago
      ]
    );
  }
}

async function seedFallbackFeedback(targetClient, userId, email, displayName) {
  const feedbackLabel = displayName || getEmailHandle(email);

  for (const template of FALLBACK_FEEDBACK_TEMPLATES) {
    const message = `${template.message_body} Submitted by ${feedbackLabel}.`;

    await targetClient.query(
      `INSERT INTO feedback (
         user_id,
         service_name,
         message,
         rating,
         created_at,
         updated_at
       )
       SELECT
         $1::uuid,
         $2::varchar,
         $3::text,
         $4::int,
         NOW() - make_interval(days => $5::int),
         NOW() - make_interval(days => $5::int)
       WHERE NOT EXISTS (
         SELECT 1
         FROM feedback
         WHERE user_id = $1::uuid
           AND service_name = $2::varchar
       )`,
      [
        userId,
        template.service_name,
        message,
        template.rating,
        template.days_ago
      ]
    );
  }
}

async function resolveTargetReplyUserId(sourceClient, targetClient, sourceReplyUserId) {
  if (!sourceReplyUserId) {
    return null;
  }

  const sourceUserResult = await sourceClient.query(
    `SELECT email
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [sourceReplyUserId]
  );

  const sourceEmail = sourceUserResult.rows[0]?.email;

  if (!sourceEmail) {
    return null;
  }

  const targetUserResult = await targetClient.query(
    `SELECT id
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [sourceEmail]
  );

  return targetUserResult.rows[0]?.id || null;
}

async function importOneUser(sourceClient, targetClient, sourceUser, options) {
  const targetPlan = await ensureTargetPlan(targetClient, options.plan || sourceUser.source_plan_name);
  const passwordHash = options.password
    ? await bcrypt.hash(options.password, SALT_ROUNDS)
    : sourceUser.password_hash;

  const upsertedUserResult = await targetClient.query(
    `INSERT INTO users (
       id,
       email,
       password_hash,
       role,
       is_active,
       email_verified,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), COALESCE($8, NOW()))
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active,
         email_verified = EXCLUDED.email_verified,
         updated_at = GREATEST(users.updated_at, EXCLUDED.updated_at)
     RETURNING id, email`,
    [
      sourceUser.id,
      sourceUser.email,
      passwordHash,
      sourceUser.role || "user",
      sourceUser.is_active !== false,
      sourceUser.email_verified !== false,
      sourceUser.created_at,
      sourceUser.updated_at || sourceUser.created_at
    ]
  );

  const targetUser = upsertedUserResult.rows[0];
  const accountLockedUntil = sourceUser.account_locked_until ? new Date(sourceUser.account_locked_until) : null;
  const accountLocked = Boolean(accountLockedUntil && Number.isFinite(accountLockedUntil.getTime()) && accountLockedUntil.getTime() > Date.now());
  const failedLoginAttempts = toFiniteNumber(
    sourceUser.failed_login_attempts != null ? sourceUser.failed_login_attempts : sourceUser.failed_attempts,
    0
  );
  const displayName = options.name || sourceUser.full_name || deriveDisplayName(sourceUser.email);

  await targetClient.query(
    `INSERT INTO user_security (
       user_id,
       failed_login_attempts,
       failed_otp_attempts,
       account_locked,
       otp_locked_until,
       otp_hash,
       otp_expires_at,
       mfa_enabled,
       mfa_secret,
       mfa_temp_secret,
       mfa_temp_expires_at,
       last_login_at,
       last_login_ip,
       last_login_country,
       last_login_device,
       suspicious_login
     )
     VALUES ($1, $2, 0, $3, NULL, NULL, NULL, $4, $5, NULL, NULL, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id) DO UPDATE
     SET failed_login_attempts = EXCLUDED.failed_login_attempts,
         failed_otp_attempts = EXCLUDED.failed_otp_attempts,
         account_locked = EXCLUDED.account_locked,
         otp_locked_until = EXCLUDED.otp_locked_until,
         otp_hash = EXCLUDED.otp_hash,
         otp_expires_at = EXCLUDED.otp_expires_at,
         mfa_enabled = EXCLUDED.mfa_enabled,
         mfa_secret = EXCLUDED.mfa_secret,
         mfa_temp_secret = EXCLUDED.mfa_temp_secret,
         mfa_temp_expires_at = EXCLUDED.mfa_temp_expires_at,
         last_login_at = EXCLUDED.last_login_at,
         last_login_ip = EXCLUDED.last_login_ip,
         last_login_country = EXCLUDED.last_login_country,
         last_login_device = EXCLUDED.last_login_device,
         suspicious_login = EXCLUDED.suspicious_login`,
    [
      targetUser.id,
      failedLoginAttempts,
      accountLocked,
      Boolean(sourceUser.mfa_enabled),
      sourceUser.mfa_secret || null,
      sourceUser.last_login_at || null,
      sourceUser.last_login_ip || null,
      sourceUser.last_login_country || null,
      sourceUser.last_login_device || null,
      Boolean(sourceUser.suspicious_login)
    ]
  );

  await targetClient.query(
    `INSERT INTO users_info (
       user_id,
       name,
       phone,
       company_name,
       country,
       plan_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE
     SET name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         company_name = EXCLUDED.company_name,
         country = EXCLUDED.country,
         plan_id = EXCLUDED.plan_id`,
    [
      targetUser.id,
      displayName,
      sourceUser.phone || null,
      sourceUser.company_name || null,
      sourceUser.country || null,
      targetPlan.id
    ]
  );

  const legacyQueries = await fetchLegacyQueries(sourceClient, sourceUser.id);
  const legacyFeedback = await fetchLegacyFeedback(sourceClient, sourceUser.id);
  const legacyUsage = await fetchLegacyUsage(sourceClient, sourceUser.id);
  const primaryAdminId = await getPrimaryAdminId(targetClient);

  for (const query of legacyQueries) {
    const repliedBy = await resolveTargetReplyUserId(sourceClient, targetClient, query.replied_by);

    await targetClient.query(
      `INSERT INTO queries (
         id,
         user_id,
         service_name,
         subject,
         message,
         category,
         priority,
         status,
         admin_reply,
         replied_by,
         replied_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()), COALESCE($13, NOW()))
       ON CONFLICT (id) DO UPDATE
       SET service_name = EXCLUDED.service_name,
           subject = EXCLUDED.subject,
           message = EXCLUDED.message,
           category = EXCLUDED.category,
           priority = EXCLUDED.priority,
           status = EXCLUDED.status,
           admin_reply = EXCLUDED.admin_reply,
           replied_by = EXCLUDED.replied_by,
           replied_at = EXCLUDED.replied_at,
           updated_at = EXCLUDED.updated_at`,
      [
        query.id,
        targetUser.id,
        query.service_name,
        query.subject,
        query.message,
        query.category,
        query.priority,
        query.status,
        query.admin_reply || null,
        repliedBy,
        query.replied_at || null,
        query.created_at,
        query.updated_at || query.created_at
      ]
    );
  }

  for (const feedback of legacyFeedback) {
    await targetClient.query(
      `INSERT INTO feedback (
         id,
         user_id,
         service_name,
         message,
         rating,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), COALESCE($7, NOW()))
       ON CONFLICT (id) DO UPDATE
       SET service_name = EXCLUDED.service_name,
           message = EXCLUDED.message,
           rating = EXCLUDED.rating,
           updated_at = EXCLUDED.updated_at`,
      [
        feedback.id,
        targetUser.id,
        feedback.service_name,
        feedback.message,
        feedback.rating,
        feedback.created_at,
        feedback.updated_at || feedback.created_at
      ]
    );
  }

  if (!legacyQueries.length) {
    await seedFallbackQueries(targetClient, targetUser.id, targetUser.email, primaryAdminId);
  }

  if (!legacyFeedback.length) {
    await seedFallbackFeedback(targetClient, targetUser.id, targetUser.email, displayName);
  }

  const storageLimitGb = toFiniteNumber(targetPlan.storage_limit_gb, PLAN_DEFAULTS[DEFAULT_TARGET_PLAN].storage_limit_gb);
  const dailyLimitGb = toFiniteNumber(targetPlan.daily_limit_gb, PLAN_DEFAULTS[DEFAULT_TARGET_PLAN].daily_limit_gb);

  for (const usage of legacyUsage) {
    const storageUsedGb = toFiniteNumber(usage.storage_used_gb, 0);
    const usagePercentage = storageLimitGb > 0
      ? Number(((storageUsedGb / storageLimitGb) * 100).toFixed(2))
      : 0;

    await targetClient.query(
      `INSERT INTO cloud_usage (
         user_id,
         usage_date,
         storage_used_gb,
         current_usage_gb,
         usage_percentage,
         daily_limit_gb,
         api_requests_today,
         data_transfer_today_gb,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), NOW())
       ON CONFLICT (user_id, usage_date) DO UPDATE
       SET storage_used_gb = EXCLUDED.storage_used_gb,
           current_usage_gb = EXCLUDED.current_usage_gb,
           usage_percentage = EXCLUDED.usage_percentage,
           daily_limit_gb = EXCLUDED.daily_limit_gb,
           api_requests_today = EXCLUDED.api_requests_today,
           data_transfer_today_gb = EXCLUDED.data_transfer_today_gb,
           updated_at = NOW()`,
      [
        targetUser.id,
        usage.usage_date,
        storageUsedGb,
        storageUsedGb,
        usagePercentage,
        dailyLimitGb,
        toFiniteNumber(usage.api_requests, 0),
        toFiniteNumber(usage.data_transfer_gb, 0),
        usage.created_at || null
      ]
    );
  }

  return {
    email: targetUser.email,
    userId: targetUser.id,
    planName: targetPlan.plan_name,
    queriesImported: legacyQueries.length || FALLBACK_QUERY_TEMPLATES.length,
    feedbackImported: legacyFeedback.length || FALLBACK_FEEDBACK_TEMPLATES.length,
    usageImported: legacyUsage.length,
    passwordReset: Boolean(options.password)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDatabaseUrl = process.env.DATABASE_URL;
  const email = args.email ? String(args.email).trim().toLowerCase() : "";
  const password = args.password ? String(args.password) : "";
  const name = args.name ? String(args.name).trim() : "";
  const plan = args.plan ? String(args.plan).trim() : "";

  if (!targetDatabaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const legacyDatabaseUrl = args["source-db-url"]
    ? String(args["source-db-url"]).trim()
    : deriveLegacyDatabaseUrl(targetDatabaseUrl);

  const sourcePool = new Pool({
    connectionString: legacyDatabaseUrl
  });

  const targetPool = new Pool({
    connectionString: targetDatabaseUrl
  });

  const sourceClient = await sourcePool.connect();
  const targetClient = await targetPool.connect();

  try {
    const sourceUsers = await fetchLegacyUsers(sourceClient, email);

    if (!sourceUsers.length) {
      throw new Error(email
        ? `Legacy user not found for ${email}`
        : "No legacy users found");
    }

    await targetClient.query("BEGIN");

    const imported = [];

    for (const sourceUser of sourceUsers) {
      imported.push(await importOneUser(sourceClient, targetClient, sourceUser, {
        password,
        name: sourceUsers.length === 1 ? name : "",
        plan
      }));
    }

    await targetClient.query("COMMIT");

    console.log("Legacy user import complete.");
    for (const item of imported) {
      console.log(
        [
          `email=${item.email}`,
          `userId=${item.userId}`,
          `plan=${item.planName}`,
          `queries=${item.queriesImported}`,
          `feedback=${item.feedbackImported}`,
          `usage=${item.usageImported}`,
          `passwordReset=${item.passwordReset}`
        ].join(" ")
      );
    }
  } catch (error) {
    await targetClient.query("ROLLBACK");
    console.error("Legacy user import failed:", error.message);
    process.exitCode = 1;
  } finally {
    sourceClient.release();
    targetClient.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

void main();
