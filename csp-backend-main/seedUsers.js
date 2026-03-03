require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const user of users) {
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      const userId = uuidv4();

      await client.query(
        `INSERT INTO users (id, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [userId, user.email, passwordHash, user.role]
      );

      await client.query(
        `INSERT INTO user_security (user_id)
         SELECT id FROM users WHERE email = $1
         ON CONFLICT (user_id) DO NOTHING`,
        [user.email]
      );

      console.log(`Seeded: ${user.email}`);
    }

    await client.query('COMMIT');
    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
