require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || 'TestPassword123!';

const users = [
  { email: 'user1@example.com', role: 'user' },
  { email: 'user2@example.com', role: 'user' },
  { email: 'user3@example.com', role: 'user' },
  { email: 'user4@example.com', role: 'user' },
  { email: 'user5@example.com', role: 'user' },
  { email: 'admin1@example.com', role: 'admin' },
  { email: 'admin2@example.com', role: 'admin' },
  { email: 'user6@example.com', role: 'user' },
  { email: 'user7@example.com', role: 'user' },
  { email: 'user8@example.com', role: 'user' }
];

async function ensureUserSecurityRow(client, userId) {
  await client.query(
    `
      INSERT INTO user_security (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  await client.query(
    `
      UPDATE user_security
      SET mfa_enabled = FALSE,
          mfa_secret = NULL,
          failed_login_attempts = 0,
          failed_otp_attempts = 0
      WHERE user_id = $1
    `,
    [userId]
  );
}

async function seedUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    for (const user of users) {
      const normalizedEmail = String(user.email).trim().toLowerCase();

      const inserted = await client.query(
        `
          INSERT INTO users (email, password_hash, role, email_verified)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `,
        [normalizedEmail, passwordHash, user.role]
      );

      let userId = inserted.rows[0]?.id || null;

      if (!userId) {
        const existing = await client.query(
          `
            SELECT id
            FROM users
            WHERE email = $1
            LIMIT 1
          `,
          [normalizedEmail]
        );
        userId = existing.rows[0]?.id || null;
      }

      if (!userId) {
        throw new Error(`Unable to resolve user id for ${normalizedEmail}`);
      }

      await client.query(
        `
          UPDATE users
          SET is_active = TRUE,
              email_verified = TRUE
          WHERE id = $1
        `,
        [userId]
      );

      await ensureUserSecurityRow(client, userId);
      console.log(`Seeded: ${normalizedEmail} (${user.role})`);
    }

    await client.query('COMMIT');
    console.log('Seeding complete.');
    console.log(`Default password used for new users: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers();
