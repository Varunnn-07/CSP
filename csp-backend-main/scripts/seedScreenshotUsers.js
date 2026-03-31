require('dotenv').config();
const pool = require('../src/config/db');

const RAHUL_EMAIL = 'rahul.sharma.dev@gmail.com';

const screenshotUsers = [
  {
    id: 'c695653f-7bfd-46bc-8718-21437aee5a54',
    email: 'priya.nair.cloud@gmail.com',
    name: 'Priya Nair Cloud',
    phone: '+1-202-555-2101',
    companyName: 'Cloud Starter Works',
    country: 'India',
    planName: 'Starter'
  },
  {
    id: '63aafb71-20de-4dd0-8103-f11b0671a6e7',
    email: 'arjun.verma.sec@gmail.com',
    name: 'Arjun Verma Sec',
    phone: '+1-202-555-2102',
    companyName: 'Secure Growth Labs',
    country: 'United States',
    planName: 'Growth'
  },
  {
    id: '508750a1-73d7-46c8-8db4-b70e382292e1',
    email: 'neha.patel.tech@gmail.com',
    name: 'Neha Patel Tech',
    phone: '+1-202-555-2103',
    companyName: 'Secure Growth Labs',
    country: 'Canada',
    planName: 'Growth'
  },
  {
    id: 'bc0f15d4-74a4-4679-9111-0b0e15c093f7',
    email: 'vikram.reddy.ops@gmail.com',
    name: 'Vikram Reddy Ops',
    phone: '+1-202-555-2104',
    companyName: 'CSP Enterprise Ops',
    country: 'United Kingdom',
    planName: 'Enterprise'
  }
];

const queryTemplates = [
  {
    serviceName: 'API Gateway',
    subject: 'API latency review',
    message: 'Observed higher response times for customer requests during business hours.',
    category: 'Technical',
    priority: 2,
    status: 'Open',
    daysAgo: 2
  },
  {
    serviceName: 'Billing Console',
    subject: 'Invoice clarification',
    message: 'Need clarification for compute and storage charges on the latest invoice.',
    category: 'Billing',
    priority: 1,
    status: 'Resolved',
    daysAgo: 6
  },
  {
    serviceName: 'Identity Manager',
    subject: 'Access policy verification',
    message: 'Need confirmation that the latest IAM policy changes were applied correctly.',
    category: 'Security',
    priority: 3,
    status: 'In Progress',
    daysAgo: 1
  }
];

const feedbackTemplates = [
  {
    serviceName: 'Portal Experience',
    message: 'The support portal is easy to navigate and quick to use.',
    rating: 5,
    daysAgo: 3
  },
  {
    serviceName: 'Usage Dashboard',
    message: 'Usage insights are helpful, but I would like more export options.',
    rating: 4,
    daysAgo: 8
  }
];

function toFixedNumber(value) {
  return Number(Number(value).toFixed(2));
}

async function seedScreenshotUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const rahulResult = await client.query(
      `SELECT password_hash
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [RAHUL_EMAIL]
    );

    if (!rahulResult.rows.length) {
      throw new Error(`Reference user ${RAHUL_EMAIL} not found`);
    }

    const passwordHash = rahulResult.rows[0].password_hash;

    const plansResult = await client.query(
      `SELECT id, plan_name, storage_limit_gb, daily_limit_gb, api_limit_per_day, data_transfer_limit_gb
       FROM subscription_plans`
    );

    const plansByName = Object.fromEntries(
      plansResult.rows.map((row) => [row.plan_name, row])
    );

    const adminResult = await client.query(
      `SELECT id
       FROM users
       WHERE role = 'admin'
       ORDER BY email
       LIMIT 1`
    );

    const adminId = adminResult.rows[0]?.id || null;

    for (const user of screenshotUsers) {
      const plan = plansByName[user.planName];

      if (!plan) {
        throw new Error(`Subscription plan ${user.planName} not found`);
      }

      const userResult = await client.query(
        `INSERT INTO users (id, email, password_hash, role, is_active, email_verified)
         VALUES ($1, $2, $3, 'user', TRUE, TRUE)
         ON CONFLICT (email) DO UPDATE
         SET role = EXCLUDED.role,
             is_active = TRUE,
             email_verified = TRUE
         RETURNING id`,
        [user.id, user.email, passwordHash]
      );

      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO user_security (
           user_id,
           failed_login_attempts,
           failed_otp_attempts,
           mfa_enabled,
           mfa_secret
         )
         VALUES ($1, 0, 0, FALSE, NULL)
         ON CONFLICT (user_id) DO UPDATE
         SET failed_login_attempts = 0,
             failed_otp_attempts = 0,
             mfa_enabled = FALSE,
             mfa_secret = NULL`,
        [userId]
      );

      await client.query(
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
        [userId, user.name, user.phone, user.companyName, user.country, plan.id]
      );

      for (const template of queryTemplates) {
        const subject = `${template.subject} - ${user.email.split('@')[0]}`;
        const message = `${template.message} User account: ${user.email}.`;
        const existingQuery = await client.query(
          `SELECT 1
           FROM queries
           WHERE user_id = $1
             AND subject = $2
           LIMIT 1`,
          [userId, subject]
        );

        if (!existingQuery.rows.length) {
          await client.query(
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
               $10,
               NOW() - make_interval(days => $11),
               NOW() - make_interval(days => GREATEST($11 - 1, 0))
             )`,
            [
              userId,
              template.serviceName,
              subject,
              message,
              template.category,
              template.priority,
              template.status,
              template.status === 'Open'
                ? null
                : template.status === 'Resolved'
                  ? 'Issue reviewed and resolved by the support team.'
                  : 'Support team is actively reviewing this request.',
              template.status === 'Open' ? null : adminId,
              template.status === 'Open'
                ? null
                : new Date(Date.now() - Math.max(template.daysAgo - 1, 0) * 24 * 60 * 60 * 1000),
              template.daysAgo
            ]
          );
        }
      }

      for (const template of feedbackTemplates) {
        const message = `${template.message} Submitted by ${user.email.split('@')[0]}.`;
        const existingFeedback = await client.query(
          `SELECT 1
           FROM feedback
           WHERE user_id = $1
             AND message = $2
           LIMIT 1`,
          [userId, message]
        );

        if (!existingFeedback.rows.length) {
          await client.query(
            `INSERT INTO feedback (
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
             )`,
            [userId, template.serviceName, message, template.rating, template.daysAgo]
          );
        }
      }

      for (let dayOffset = 0; dayOffset < 10; dayOffset += 1) {
        const storageUsed = toFixedNumber(
          Number(plan.storage_limit_gb) * (0.2 + dayOffset * 0.015)
        );
        const usagePercentage = toFixedNumber(
          (storageUsed / Number(plan.storage_limit_gb)) * 100
        );
        const apiRequestsToday = Math.min(
          Number(plan.api_limit_per_day),
          180 + dayOffset * 37
        );
        const dataTransferToday = toFixedNumber(
          Math.min(
            Number(plan.data_transfer_limit_gb),
            4 + dayOffset * 0.9
          )
        );

        await client.query(
          `INSERT INTO cloud_usage (
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
             CURRENT_DATE - $2::int,
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
               updated_at = NOW()`,
          [
            userId,
            dayOffset,
            storageUsed,
            usagePercentage,
            Number(plan.daily_limit_gb),
            apiRequestsToday,
            dataTransferToday
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Seeded screenshot users and reset MFA only for those users.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed screenshot users:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedScreenshotUsers();
