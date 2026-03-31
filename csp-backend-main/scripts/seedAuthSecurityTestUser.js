require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const EMAIL = 'pothujayanthreddy6859@gmail.com';
const PASSWORD = 'Password@123';
const NAME = 'Jayanth';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

const planSeed = {
  planName: 'Starter',
  storageLimitGb: 100,
  dailyLimitGb: 10,
  apiLimitPerDay: 1000,
  dataTransferLimitGb: 50
};

const querySeeds = [
  {
    serviceName: 'Storage Gateway',
    subject: 'Usage spike investigation',
    message: 'Observed a sudden increase in storage consumption over the last 24 hours.',
    category: 'Technical',
    priority: 2,
    status: 'Open',
    daysAgo: 1
  },
  {
    serviceName: 'Identity Manager',
    subject: 'MFA enforcement confirmation',
    message: 'Need confirmation that MFA enrollment is being enforced correctly for this account.',
    category: 'Security',
    priority: 3,
    status: 'In Progress',
    daysAgo: 3
  },
  {
    serviceName: 'Billing Console',
    subject: 'Plan usage clarification',
    message: 'Need clarification on the current storage plan usage and included daily transfer limits.',
    category: 'Billing',
    priority: 1,
    status: 'Resolved',
    daysAgo: 6
  }
];

const feedbackSeeds = [
  {
    serviceName: 'Dashboard',
    message: 'The dashboard is clear and the usage cards are easy to understand.',
    rating: 5,
    daysAgo: 2
  },
  {
    serviceName: 'Support Portal',
    message: 'The query tracking view is helpful, but I would like faster updates on resolution status.',
    rating: 4,
    daysAgo: 8
  }
];

const usageSeeds = [
  { dayOffset: 0, currentUsageGb: 25.0, usagePercentage: 25.0, apiRequestsToday: 342, dataTransferTodayGb: 6.8 },
  { dayOffset: 1, currentUsageGb: 24.1, usagePercentage: 24.1, apiRequestsToday: 328, dataTransferTodayGb: 6.3 },
  { dayOffset: 2, currentUsageGb: 23.4, usagePercentage: 23.4, apiRequestsToday: 316, dataTransferTodayGb: 6.0 },
  { dayOffset: 3, currentUsageGb: 22.9, usagePercentage: 22.9, apiRequestsToday: 301, dataTransferTodayGb: 5.6 },
  { dayOffset: 4, currentUsageGb: 22.2, usagePercentage: 22.2, apiRequestsToday: 287, dataTransferTodayGb: 5.2 },
  { dayOffset: 5, currentUsageGb: 21.8, usagePercentage: 21.8, apiRequestsToday: 274, dataTransferTodayGb: 4.9 },
  { dayOffset: 6, currentUsageGb: 21.1, usagePercentage: 21.1, apiRequestsToday: 260, dataTransferTodayGb: 4.5 }
];

async function seedAuthSecurityTestUser() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    const planResult = await client.query(
      `
        INSERT INTO subscription_plans (
          plan_name,
          storage_limit_gb,
          daily_limit_gb,
          api_limit_per_day,
          data_transfer_limit_gb
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (plan_name) DO UPDATE
        SET storage_limit_gb = EXCLUDED.storage_limit_gb,
            daily_limit_gb = EXCLUDED.daily_limit_gb,
            api_limit_per_day = EXCLUDED.api_limit_per_day,
            data_transfer_limit_gb = EXCLUDED.data_transfer_limit_gb
        RETURNING id, storage_limit_gb, daily_limit_gb
      `,
      [
        planSeed.planName,
        planSeed.storageLimitGb,
        planSeed.dailyLimitGb,
        planSeed.apiLimitPerDay,
        planSeed.dataTransferLimitGb
      ]
    );

    const plan = planResult.rows[0];

    const userResult = await client.query(
      `
        INSERT INTO users (
          email,
          password_hash,
          role,
          is_active,
          email_verified
        )
        VALUES ($1, $2, 'user', TRUE, TRUE)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            is_active = TRUE,
            email_verified = TRUE
        RETURNING id
      `,
      [EMAIL, passwordHash]
    );

    const userId = userResult.rows[0].id;

    await client.query(
      `
        INSERT INTO users_info (
          user_id,
          name,
          plan_id
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE
        SET name = EXCLUDED.name,
            plan_id = EXCLUDED.plan_id
      `,
      [userId, NAME, plan.id]
    );

    await client.query(
      `
        INSERT INTO user_security (
          user_id,
          failed_login_attempts,
          failed_otp_attempts,
          account_locked,
          otp_locked_until,
          mfa_enabled,
          mfa_secret
        )
        VALUES ($1, 0, 0, FALSE, NULL, FALSE, NULL)
        ON CONFLICT (user_id) DO UPDATE
        SET failed_login_attempts = 0,
            failed_otp_attempts = 0,
            account_locked = FALSE,
            otp_locked_until = NULL,
            mfa_enabled = FALSE,
            mfa_secret = NULL
      `,
      [userId]
    );

    for (const seed of querySeeds) {
      const subject = `${seed.subject} - ${EMAIL.split('@')[0]}`;
      const message = `${seed.message} User account: ${EMAIL}.`;

      const existingQuery = await client.query(
        `
          SELECT 1
          FROM queries
          WHERE user_id = $1
            AND subject = $2
          LIMIT 1
        `,
        [userId, subject]
      );

      if (!existingQuery.rows.length) {
        await client.query(
          `
            INSERT INTO queries (
              user_id,
              service_name,
              subject,
              message,
              category,
              priority,
              status,
              admin_reply,
              replied_at,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              NOW() - make_interval(days => $10),
              NOW() - make_interval(days => GREATEST($10 - 1, 0))
            )
          `,
          [
            userId,
            seed.serviceName,
            subject,
            message,
            seed.category,
            seed.priority,
            seed.status,
            seed.status === 'Resolved' ? 'The request was reviewed and resolved by support.' : null,
            seed.status === 'Resolved'
              ? new Date(Date.now() - Math.max(seed.daysAgo - 1, 0) * 24 * 60 * 60 * 1000)
              : null,
            seed.daysAgo
          ]
        );
      }
    }

    for (const seed of feedbackSeeds) {
      const message = `${seed.message} Submitted by ${NAME}.`;

      const existingFeedback = await client.query(
        `
          SELECT 1
          FROM feedback
          WHERE user_id = $1
            AND message = $2
          LIMIT 1
        `,
        [userId, message]
      );

      if (!existingFeedback.rows.length) {
        await client.query(
          `
            INSERT INTO feedback (
              user_id,
              service_name,
              message,
              rating,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              NOW() - make_interval(days => $5),
              NOW() - make_interval(days => $5)
            )
          `,
          [userId, seed.serviceName, message, seed.rating, seed.daysAgo]
        );
      }
    }

    for (const seed of usageSeeds) {
      await client.query(
        `
          INSERT INTO cloud_usage (
            user_id,
            usage_date,
            storage_used_gb,
            current_usage_gb,
            usage_percentage,
            daily_limit_gb,
            api_requests_today,
            data_transfer_today_gb
          )
          VALUES (
            $1,
            CURRENT_DATE - $2::integer,
            $3,
            $3,
            $4,
            $5,
            $6,
            $7
          )
          ON CONFLICT (user_id, usage_date) DO UPDATE
          SET storage_used_gb = EXCLUDED.storage_used_gb,
              current_usage_gb = EXCLUDED.current_usage_gb,
              usage_percentage = EXCLUDED.usage_percentage,
              daily_limit_gb = EXCLUDED.daily_limit_gb,
              api_requests_today = EXCLUDED.api_requests_today,
              data_transfer_today_gb = EXCLUDED.data_transfer_today_gb,
              updated_at = NOW()
        `,
        [
          userId,
          seed.dayOffset,
          seed.currentUsageGb,
          seed.usagePercentage,
          plan.daily_limit_gb,
          seed.apiRequestsToday,
          seed.dataTransferTodayGb
        ]
      );
    }

    await client.query('COMMIT');

    console.log(`Seeded auth security test user: ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed auth security test user:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAuthSecurityTestUser();
