require('dotenv').config();
const pool = require('../src/config/db');

async function resetMfaForAllUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE users
        SET is_active = TRUE,
            email_verified = TRUE
      `
    );

    const result = await client.query(
      `
        UPDATE user_security
        SET mfa_enabled = FALSE,
            mfa_secret = NULL,
            failed_login_attempts = 0,
            failed_otp_attempts = 0
      `
    );

    await client.query('DELETE FROM blocked_ips');

    await client.query('COMMIT');
    console.log(`Reset auth state for ${result.rowCount} user_security rows.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to reset MFA state:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

resetMfaForAllUsers();
