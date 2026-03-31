const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const pool = require("../config/db");

const { addIpBlock } = require("../security/ipBlock.service");
const tokenService = require("../security/token.service");
const emailService = require("./email.service");
const auditLogger = require("../utils/auditLogger");
const {
  encryptMfaSecret,
  decryptMfaSecret
} = require("../security/mfaSecretCrypto");

const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 3);
const MAX_FAILED_OTP_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 5;
const MAX_IP_FAILURES = Number(process.env.MAX_IP_FAILURES || 5);
const IP_BLOCK_DURATION_MINUTES = Number(process.env.IP_BLOCK_DURATION_MINUTES || 60);
const IP_FAILURE_WINDOW_MINUTES = Number(process.env.IP_FAILURE_WINDOW_MINUTES || 15);
const PRE_AUTH_ENFORCED = ['1', 'true', 'yes'].includes(
  String(process.env.ENFORCE_PREAUTH_TOKEN || 'false').toLowerCase()
);
const SUSPICIOUS_RAPID_WINDOW_MINUTES = 5;
const SUSPICIOUS_RAPID_FAILURES = 5;
const SUSPICIOUS_MULTI_IP_WINDOW_MINUTES = 15;
const SUSPICIOUS_MULTI_IP_FAILURES = 3;

let suspiciousAttemptsWritableCache = null;

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Authentication failed",
  ACCOUNT_LOCKED: "Account locked. Contact support.",
  EMAIL_NOT_VERIFIED: "Authentication failed",
  MFA_NOT_CONFIGURED: "Authentication failed",
  MFA_ALREADY_ENABLED: "Request could not be processed",
  INVALID_PREAUTH: "Authentication failed",
  PREAUTH_REQUIRED: "Authentication failed",
  INVALID_REFRESH_TOKEN: "Authentication failed",
  OTP_INVALID: "Verification failed",
  OTP_LOCKED: "Too many OTP attempts. Try again later"
};

function buildFailure(errorCode, extra = {}) {
  return {
    success: false,
    errorCode,
    message: ERROR_MESSAGES[errorCode] || "Authentication failed",
    ...extra
  };
}

// FIXED
function toOtpRemainingSeconds(otpLockUntil) {
  const expiresAtMs = new Date(otpLockUntil || 0).getTime();

  if (!Number.isFinite(expiresAtMs)) {
    return 0;
  }

  return Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
}

// FIXED
function buildOtpLockedFailure(otpLockUntil) {
  return buildFailure("OTP_LOCKED", {
    remainingTime: toOtpRemainingSeconds(otpLockUntil)
  });
}

// FIXED
async function normalizeSecurityRecord(db, userId, securityRecord) {
  const normalized = {
    failed_login_attempts: Number(securityRecord?.failed_login_attempts || 0),
    failed_otp_attempts: Number(securityRecord?.failed_otp_attempts || 0),
    account_locked: Boolean(securityRecord?.account_locked),
    otp_locked_until: securityRecord?.otp_locked_until || null,
    mfa_enabled: Boolean(securityRecord?.mfa_enabled),
    mfa_secret: securityRecord?.mfa_secret || null
  };

  const needsPersistence =
    securityRecord?.failed_login_attempts == null
    || securityRecord?.failed_otp_attempts == null
    || securityRecord?.account_locked == null
    || securityRecord?.otp_locked_until === undefined
    || securityRecord?.mfa_enabled == null;

  if (needsPersistence) {
    await db.query(
      `UPDATE user_security
       SET failed_login_attempts = $2,
           failed_otp_attempts = $3,
           account_locked = $4,
           otp_locked_until = $5,
           mfa_enabled = $6
       WHERE user_id = $1`,
      [
        userId,
        normalized.failed_login_attempts,
        normalized.failed_otp_attempts,
        normalized.account_locked,
        normalized.otp_locked_until,
        normalized.mfa_enabled
      ]
    );
  }

  return normalized;
}

async function ensureSecurityRecord(db, userId, { forUpdate = false } = {}) {
  const selectSecurityRecordQuery = forUpdate
    ? `SELECT
         failed_login_attempts,
         failed_otp_attempts,
         account_locked,
         otp_locked_until,
         mfa_enabled,
         mfa_secret
       FROM user_security
       WHERE user_id = $1
       FOR UPDATE`
    : `SELECT
         failed_login_attempts,
         failed_otp_attempts,
         account_locked,
         otp_locked_until,
         mfa_enabled,
         mfa_secret
       FROM user_security
       WHERE user_id = $1`;

  let securityResult = await db.query(
    selectSecurityRecordQuery,
    [userId]
  );

  if (!securityResult.rows.length) {
    await db.query(
      `INSERT INTO user_security (
         user_id,
         failed_login_attempts,
         failed_otp_attempts,
         account_locked,
         otp_locked_until,
         mfa_enabled
       )
       VALUES ($1, 0, 0, FALSE, NULL, FALSE)`,
      [userId]
    );

    securityResult = await db.query(
      selectSecurityRecordQuery,
      [userId]
    );
  }

  return normalizeSecurityRecord(db, userId, securityResult.rows[0]);
}

async function getUserById(db, userId) {
  const result = await db.query(
    `SELECT id, email, role, is_active, email_verified
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

function normalizeStoredMfaSecret(value) {
  let decryptedSecret;

  try {
    decryptedSecret = decryptMfaSecret(value);
  } catch {
    return null;
  }

  const secret = String(decryptedSecret || "").trim().toUpperCase();

  if (!secret) {
    return null;
  }

  if (!/^[A-Z2-7]+=*$/.test(secret)) {
    return null;
  }

  return secret;
}

function isFutureTimestamp(value) {
  if (!value) {
    return false;
  }

  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function createPreAuthToken(userId) {
  return tokenService.signPreAuthToken(userId);
}

function normalizeTokenValue(value) {
  return String(value || '').trim();
}

async function validatePreAuthToken(db, userId, context, preAuthToken, flow) {
  const normalizedToken = normalizeTokenValue(preAuthToken);

  if (!normalizedToken) {
    await auditLogger.log({
      db,
      userId,
      eventType: PRE_AUTH_ENFORCED ? 'PRE_AUTH_REQUIRED' : 'PRE_AUTH_FALLBACK',
      action: PRE_AUTH_ENFORCED
        ? 'Pre-auth token required before MFA verification'
        : 'Legacy MFA flow used without pre-auth token',
      severity: PRE_AUTH_ENFORCED ? 'high' : 'medium',
      status: PRE_AUTH_ENFORCED ? 'failure' : 'success',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        flow
      }
    });

    return PRE_AUTH_ENFORCED ? buildFailure('PREAUTH_REQUIRED') : null;
  }

  try {
    const decoded = tokenService.verifyPreAuthToken(normalizedToken);

    if (String(decoded.sub) !== String(userId) || decoded.stage !== 'pre-auth') {
      throw new Error('Pre-auth token does not match user or stage');
    }

    await auditLogger.log({
      db,
      userId,
      eventType: 'PRE_AUTH_VALIDATED',
      action: 'Pre-auth token validated',
      severity: 'low',
      status: 'success',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        flow
      }
    });

    return null;
  } catch {
    await auditLogger.log({
      db,
      userId,
      eventType: 'PRE_AUTH_INVALID',
      action: 'Invalid pre-auth token',
      severity: 'high',
      status: 'failure',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        flow
      }
    });

    return buildFailure('INVALID_PREAUTH');
  }
}

async function persistRefreshToken(db, userId, refreshToken) {
  const refreshTokenHash = tokenService.hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = tokenService.refreshExpiryDate();

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, refreshTokenHash, refreshTokenExpiresAt]
  );
}

async function findRefreshTokenRecord(db, refreshToken, { forUpdate = false } = {}) {
  const tokenHash = tokenService.hashRefreshToken(refreshToken);
  const lockClause = forUpdate ? 'FOR UPDATE' : '';
  const result = await db.query(
    `SELECT
       rt.id,
       rt.user_id,
       u.role,
       u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.expires_at > NOW()
       AND COALESCE(rt.revoked, FALSE) = FALSE
     LIMIT 1
     ${lockClause}`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

async function issueSessionTokens(db, userId, role, context, auditAction) {
  const tokens = tokenService.generateTokens(userId, role);

  await persistRefreshToken(db, userId, tokens.refreshToken);

  await db.query(
    `UPDATE user_security
     SET failed_otp_attempts = 0,
         otp_locked_until = NULL,
         last_login_at = NOW(),
         last_login_ip = $2
     WHERE user_id = $1`,
    [userId, context.ip || null]
  );

  await auditLogger.log({
    db,
    userId,
    eventType: "LOGIN_SUCCESS",
    action: auditAction,
    severity: "low",
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId
  });

  return {
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

function createMfaSecret(email) {
  return speakeasy.generateSecret({
    length: 20,
    name: `CSPCloud:${email}`
  });
}

async function storeMfaSecret(db, userId, plainSecret) {
  const encryptedSecret = encryptMfaSecret(plainSecret);

  await db.query(
    `UPDATE user_security
     SET mfa_enabled = FALSE,
         mfa_secret = $1
     WHERE user_id = $2`,
    [encryptedSecret, userId]
  );
}

async function maybeBlockIp(db, context, reason, metadata = {}) {
  if (!context.ip || context.ip === "unknown") {
    return null;
  }

  let failureCount = 0;

  try {
    const result = await db.query(
      `SELECT COUNT(*)::int AS failure_count
       FROM audit_logs
       WHERE ip = $1
         AND status = 'failure'
         AND event_type = ANY($2::text[])
         AND event_timestamp > NOW() - ($3 * INTERVAL '1 minute')`,
      [context.ip, ["LOGIN_FAILED", "MFA_FAILED", "ACCOUNT_LOCKED"], IP_FAILURE_WINDOW_MINUTES]
    );

    failureCount = Number(result.rows[0]?.failure_count || 0);
  } catch (error) {
    if (!["42703", "42P01"].includes(error.code)) {
      throw error;
    }

    const fallbackResult = await db.query(
      `SELECT COUNT(*)::int AS failure_count
       FROM audit_logs
       WHERE ip_address = $1
         AND status = 'failure'
         AND action = ANY($2::text[])
         AND created_at > NOW() - ($3 * INTERVAL '1 minute')`,
      [context.ip, ["LOGIN_FAILED", "MFA_FAILED", "ACCOUNT_LOCKED"], IP_FAILURE_WINDOW_MINUTES]
    );

    failureCount = Number(fallbackResult.rows[0]?.failure_count || 0);
  }

  if (failureCount < MAX_IP_FAILURES) {
    return null;
  }

  const block = await addIpBlock(db, context.ip, reason, IP_BLOCK_DURATION_MINUTES);

  if (!block) {
    return null;
  }

  await auditLogger.log({
    db,
    userId: metadata.userId || null,
    eventType: "IP_BLOCKED",
    action: "IP blocked after repeated authentication failures",
    severity: "high",
    status: "failure",
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: {
      failureCount,
      reason,
      blockedUntil: block.blocked_until,
      ...metadata
    }
  });

  return block;
}

async function isSuspiciousAttemptsWritable(db) {
  if (typeof suspiciousAttemptsWritableCache === "boolean") {
    return suspiciousAttemptsWritableCache;
  }

  try {
    const result = await db.query(
      `SELECT relkind
       FROM pg_class
       WHERE relname = 'suspicious_login_attempts'
       LIMIT 1`
    );

    suspiciousAttemptsWritableCache = ["r", "p"].includes(result.rows[0]?.relkind);
  } catch {
    suspiciousAttemptsWritableCache = false;
  }

  return suspiciousAttemptsWritableCache;
}

async function recordSuspiciousLoginAttempt(db, context, { userId = null, attemptedEmail = null, reason, metrics }) {
  const metadata = {
    attemptedEmail,
    reason,
    rapidFailures: metrics.rapidFailures,
    recentFailures: metrics.recentFailures,
    distinctIps: metrics.distinctIps
  };

  await auditLogger.log({
    db,
    userId,
    eventType: "SUSPICIOUS_LOGIN_ATTEMPT",
    action: "Suspicious login activity detected",
    severity: "high",
    status: "failure",
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata
  });

  if (await isSuspiciousAttemptsWritable(db)) {
    try {
      await db.query(
        `INSERT INTO suspicious_login_attempts (ip, attempts)
         VALUES ($1, $2)`,
        [context.ip, metrics.recentFailures]
      );
    } catch {
      suspiciousAttemptsWritableCache = false;
    }
  }
}

async function hasRecentSuspiciousLoginRecord(db, { userId = null, attemptedEmail = null }) {
  try {
    const result = await db.query(
      `SELECT 1
       FROM audit_logs
       WHERE event_type = 'SUSPICIOUS_LOGIN_ATTEMPT'
         AND event_timestamp > NOW() - ($1 * INTERVAL '1 minute')
         AND (
           ($2::uuid IS NOT NULL AND user_id = $2)
           OR ($3::text IS NOT NULL AND metadata->>'attemptedEmail' = $3)
         )
       LIMIT 1`,
      [SUSPICIOUS_MULTI_IP_WINDOW_MINUTES, userId, attemptedEmail]
    );

    return result.rowCount > 0;
  } catch (error) {
    if (!["42703", "42P01"].includes(error.code)) {
      throw error;
    }

    const fallbackResult = await db.query(
      `SELECT 1
       FROM audit_logs
       WHERE action = 'Suspicious login activity detected'
         AND created_at > NOW() - ($1 * INTERVAL '1 minute')
         AND (
           ($2::uuid IS NOT NULL AND user_id = $2)
           OR ($3::text IS NOT NULL AND metadata->>'attemptedEmail' = $3)
         )
       LIMIT 1`,
      [SUSPICIOUS_MULTI_IP_WINDOW_MINUTES, userId, attemptedEmail]
    );

    return fallbackResult.rowCount > 0;
  }
}

async function detectSuspiciousLoginActivity(db, context, { userId = null, attemptedEmail = null }) {
  let metrics;

  try {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE event_timestamp > NOW() - ($1 * INTERVAL '1 minute')
         )::int AS rapid_failures,
         COUNT(*) FILTER (
           WHERE event_timestamp > NOW() - ($2 * INTERVAL '1 minute')
         )::int AS recent_failures,
         COUNT(DISTINCT ip) FILTER (
           WHERE event_timestamp > NOW() - ($2 * INTERVAL '1 minute')
             AND ip IS NOT NULL
         )::int AS distinct_ips
       FROM audit_logs
       WHERE status = 'failure'
         AND event_type = 'LOGIN_FAILED'
         AND (
           ($3::uuid IS NOT NULL AND user_id = $3)
           OR ($4::text IS NOT NULL AND metadata->>'attemptedEmail' = $4)
         )`,
      [SUSPICIOUS_RAPID_WINDOW_MINUTES, SUSPICIOUS_MULTI_IP_WINDOW_MINUTES, userId, attemptedEmail]
    );

    metrics = {
      rapidFailures: Number(result.rows[0]?.rapid_failures || 0),
      recentFailures: Number(result.rows[0]?.recent_failures || 0),
      distinctIps: Number(result.rows[0]?.distinct_ips || 0)
    };
  } catch (error) {
    if (!["42703", "42P01"].includes(error.code)) {
      throw error;
    }

    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE created_at > NOW() - ($1 * INTERVAL '1 minute')
         )::int AS rapid_failures,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - ($2 * INTERVAL '1 minute')
         )::int AS recent_failures,
         COUNT(DISTINCT ip_address) FILTER (
           WHERE created_at > NOW() - ($2 * INTERVAL '1 minute')
             AND ip_address IS NOT NULL
         )::int AS distinct_ips
       FROM audit_logs
       WHERE status = 'failure'
         AND action = 'LOGIN_FAILED'
         AND (
           ($3::uuid IS NOT NULL AND user_id = $3)
           OR ($4::text IS NOT NULL AND metadata->>'attemptedEmail' = $4)
         )`,
      [SUSPICIOUS_RAPID_WINDOW_MINUTES, SUSPICIOUS_MULTI_IP_WINDOW_MINUTES, userId, attemptedEmail]
    );

    metrics = {
      rapidFailures: Number(result.rows[0]?.rapid_failures || 0),
      recentFailures: Number(result.rows[0]?.recent_failures || 0),
      distinctIps: Number(result.rows[0]?.distinct_ips || 0)
    };
  }

  const rapidAttempts = metrics.rapidFailures >= SUSPICIOUS_RAPID_FAILURES;
  const multipleIps = metrics.recentFailures >= SUSPICIOUS_MULTI_IP_FAILURES
    && metrics.distinctIps >= SUSPICIOUS_MULTI_IP_FAILURES;

  if (!rapidAttempts && !multipleIps) {
    return;
  }

  if (await hasRecentSuspiciousLoginRecord(db, { userId, attemptedEmail })) {
    return;
  }

  await recordSuspiciousLoginAttempt(db, context, {
    userId,
    attemptedEmail,
    reason: rapidAttempts ? "rapid_attempts" : "multiple_source_ips",
    metrics
  });
}

async function registerAnonymousLoginFailure(db, email, context) {
  await auditLogger.log({
    db,
    userId: null,
    eventType: "LOGIN_FAILED",
    action: "Invalid login attempt",
    severity: "medium",
    status: "failure",
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: {
      attemptedEmail: email
    }
  });

  await detectSuspiciousLoginActivity(db, context, {
    attemptedEmail: email
  });

  await maybeBlockIp(db, context, "Repeated invalid login attempts", {
    attemptedEmail: email
  });
}

async function registerLoginFailure(db, user, security, context) {
  const attempts = Number(security.failed_login_attempts || 0) + 1;
  const shouldLockAccount = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;

  if (shouldLockAccount) {
    await db.query(
      `UPDATE user_security
       SET failed_login_attempts = $2,
           account_locked = TRUE
       WHERE user_id = $1`,
      [user.id, attempts]
    );

    await auditLogger.log({
      db,
      userId: user.id,
      eventType: "ACCOUNT_LOCKED",
      action: "Account locked after repeated failed password attempts",
      severity: "high",
      status: "failure",
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });
  } else {
    await db.query(
      `UPDATE user_security
       SET failed_login_attempts = $2
       WHERE user_id = $1`,
      [user.id, attempts]
    );
  }

  await auditLogger.log({
    db,
    userId: user.id,
    eventType: "LOGIN_FAILED",
    action: "Invalid login attempt",
    severity: shouldLockAccount ? "high" : "medium",
    status: "failure",
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: {
      attemptedEmail: user.email
    }
  });

  await detectSuspiciousLoginActivity(db, context, {
    userId: user.id,
    attemptedEmail: user.email
  });

  await maybeBlockIp(
    db,
    context,
    shouldLockAccount ? "Repeated failed login attempts caused an account lock" : "Repeated failed login attempts",
    {
      userId: user.id,
      attemptedEmail: user.email
    }
  );

  return shouldLockAccount;
}

async function registerOtpFailure(db, userId, currentFailedAttempts, context, action) {
  const attempts = Number(currentFailedAttempts || 0) + 1;
  const shouldLock = attempts >= MAX_FAILED_OTP_ATTEMPTS;
  let otpLockUntil = null;

  if (shouldLock) {
    otpLockUntil = new Date(Date.now() + (OTP_LOCK_MINUTES * 60 * 1000));

    await db.query(
      `UPDATE user_security
       SET failed_otp_attempts = 0,
           otp_locked_until = $2
       WHERE user_id = $1`,
      [userId, otpLockUntil]
    );
  } else {
    await db.query(
      `UPDATE user_security
       SET failed_otp_attempts = $2
       WHERE user_id = $1`,
      [userId, attempts]
    );
  }

  await auditLogger.log({
    db,
    userId,
    eventType: "MFA_FAILED",
    action,
    severity: shouldLock ? "high" : "medium",
    status: "failure",
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId
  });

  if (shouldLock) {
    await auditLogger.log({
      db,
      userId,
      eventType: "OTP_LOCKED",
      action: `OTP temporarily locked for ${OTP_LOCK_MINUTES} minutes`,
      severity: "high",
      status: "failure",
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
      });
  }

  await maybeBlockIp(
    db,
    context,
    shouldLock ? "Repeated OTP failures caused a temporary OTP lock" : "Repeated OTP verification failures",
    {
      userId
    }
  );

  return shouldLock
    ? buildOtpLockedFailure(otpLockUntil)
    : buildFailure("OTP_INVALID");
}

async function login(email, password, context) {
  const client = await pool.connect();
  let shouldSendLockEmail = false;
  let lockedEmail = null;

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, email, password_hash, role, is_active, email_verified
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    if (!userResult.rows.length) {
      await registerAnonymousLoginFailure(client, email, context);
      await client.query("COMMIT");
      return buildFailure("INVALID_CREDENTIALS");
    }

    const user = userResult.rows[0];
    const security = await ensureSecurityRecord(client, user.id, { forUpdate: true });

    if (!user.is_active || security.account_locked) {
      await auditLogger.log({
        db: client,
        userId: user.id,
        eventType: "ACCOUNT_LOCKED",
        action: "Blocked login attempt for locked account",
        severity: "high",
        status: "failure",
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId
      });

      await client.query("COMMIT");
      return buildFailure("ACCOUNT_LOCKED");
    }

    if (!user.email_verified) {
      await client.query("COMMIT");
      return buildFailure("EMAIL_NOT_VERIFIED");
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      const shouldLockAccount = await registerLoginFailure(client, user, security, context);

      if (shouldLockAccount) {
        shouldSendLockEmail = true;
        lockedEmail = user.email;
      }

      await client.query("COMMIT");

      if (shouldSendLockEmail) {
        try {
          await emailService.sendAccountLockedEmail(lockedEmail);
        } catch (error) {
          console.error("Account locked email failed:", error.message);
        }

        return buildFailure("ACCOUNT_LOCKED");
      }

      return buildFailure("INVALID_CREDENTIALS");
    }

    await client.query(
      `UPDATE user_security
       SET failed_login_attempts = 0
       WHERE user_id = $1`,
      [user.id]
    );

    const preAuthToken = createPreAuthToken(user.id);

    await auditLogger.log({
      db: client,
      userId: user.id,
      eventType: 'PRE_AUTH_ISSUED',
      action: 'Pre-auth token issued after password verification',
      severity: 'low',
      status: 'success',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    const existingMfaSecret = normalizeStoredMfaSecret(security.mfa_secret);

    if (!security.mfa_enabled || !existingMfaSecret) {
      const secret = createMfaSecret(user.email);
      await storeMfaSecret(client, user.id, secret.base32);

      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      await auditLogger.log({
        db: client,
        userId: user.id,
        eventType: "MFA_SETUP",
        action: "MFA enrollment required",
        severity: "low",
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId
      });

      const response = {
        success: true,
        mfa_setup_required: true,
        userId: user.id,
        preAuthToken,
        qrCode,
        manualCode: secret.base32
      };

      await client.query("COMMIT");
      return response;
    }

    await auditLogger.log({
      db: client,
      userId: user.id,
      eventType: "MFA_REQUIRED",
      action: "User must verify TOTP",
      severity: "low",
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    const response = {
      success: true,
      mfa_required: true,
      userId: user.id,
      preAuthToken
    };

    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setupMfa(userId, context, preAuthToken) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserById(client, userId);

    if (!user) {
      await client.query("COMMIT");
      return buildFailure("INVALID_CREDENTIALS");
    }

    const security = await ensureSecurityRecord(client, userId, { forUpdate: true });

    if (security.account_locked || !user.is_active) {
      await client.query("COMMIT");
      return buildFailure("ACCOUNT_LOCKED");
    }

    if (security.mfa_enabled) {
      await client.query("COMMIT");
      return buildFailure("MFA_ALREADY_ENABLED");
    }

    const preAuthFailure = await validatePreAuthToken(
      client,
      userId,
      context,
      preAuthToken,
      'mfa_setup'
    );

    if (preAuthFailure) {
      await client.query("COMMIT");
      return preAuthFailure;
    }

    const effectivePreAuthToken = normalizeTokenValue(preAuthToken) || createPreAuthToken(userId);

    const secret = createMfaSecret(user.email);
    await storeMfaSecret(client, userId, secret.base32);

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    await auditLogger.log({
      db: client,
      userId,
      eventType: "MFA_SETUP",
      action: "MFA enrollment initiated",
      severity: "low",
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    await client.query("COMMIT");

    return {
      success: true,
      userId,
      preAuthToken: effectivePreAuthToken,
      qrCode,
      manualCode: secret.base32
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function verifyMfaSetup(userId, token, context, preAuthToken) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserById(client, userId);

    if (!user) {
      await client.query("COMMIT");
      return buildFailure("INVALID_CREDENTIALS");
    }

    const security = await ensureSecurityRecord(client, userId, { forUpdate: true });

    if (security.account_locked || !user.is_active) {
      await client.query("COMMIT");
      return buildFailure("ACCOUNT_LOCKED");
    }

    if (isFutureTimestamp(security.otp_locked_until)) {
      await client.query("COMMIT");
      return buildOtpLockedFailure(security.otp_locked_until);
    }

    const setupSecret = normalizeStoredMfaSecret(security.mfa_secret);

    if (!setupSecret) {
      await client.query("COMMIT");
      return buildFailure("MFA_NOT_CONFIGURED");
    }

    if (security.mfa_enabled) {
      await client.query("COMMIT");
      return buildFailure("MFA_ALREADY_ENABLED");
    }

    const preAuthFailure = await validatePreAuthToken(
      client,
      userId,
      context,
      preAuthToken,
      'mfa_verify_setup'
    );

    if (preAuthFailure) {
      await client.query("COMMIT");
      return preAuthFailure;
    }

    const verified = speakeasy.totp.verify({
      secret: setupSecret,
      encoding: "base32",
      token,
      window: 2
    });

    if (!verified) {
      const failure = await registerOtpFailure(
        client,
        userId,
        security.failed_otp_attempts,
        context,
        "Invalid MFA setup code"
      );

      await client.query("COMMIT");
      return failure;
    }

    await client.query(
      `UPDATE user_security
       SET mfa_enabled = TRUE,
           failed_otp_attempts = 0,
           otp_locked_until = NULL
       WHERE user_id = $1`,
      [userId]
    );

    await auditLogger.log({
      db: client,
      userId,
      eventType: "MFA_SUCCESS",
      action: "MFA enabled",
      severity: "low",
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    const response = await issueSessionTokens(
      client,
      userId,
      user.role || "user",
      context,
      "User authenticated after MFA setup"
    );

    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function verifyOtp(userId, token, context, preAuthToken) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserById(client, userId);

    if (!user) {
      await client.query("COMMIT");
      return buildFailure("INVALID_CREDENTIALS");
    }

    const security = await ensureSecurityRecord(client, userId, { forUpdate: true });

    if (security.account_locked || !user.is_active) {
      await client.query("COMMIT");
      return buildFailure("ACCOUNT_LOCKED");
    }

    if (isFutureTimestamp(security.otp_locked_until)) {
      await client.query("COMMIT");
      return buildOtpLockedFailure(security.otp_locked_until);
    }

    const otpSecret = normalizeStoredMfaSecret(security.mfa_secret);

    if (!security.mfa_enabled || !otpSecret) {
      await client.query("COMMIT");
      return buildFailure("MFA_NOT_CONFIGURED");
    }

    const preAuthFailure = await validatePreAuthToken(
      client,
      userId,
      context,
      preAuthToken,
      'mfa_verify'
    );

    if (preAuthFailure) {
      await client.query("COMMIT");
      return preAuthFailure;
    }

    const verified = speakeasy.totp.verify({
      secret: otpSecret,
      encoding: "base32",
      token,
      window: 2
    });

    if (!verified) {
      const failure = await registerOtpFailure(
        client,
        userId,
        security.failed_otp_attempts,
        context,
        "Invalid OTP"
      );

      await client.query("COMMIT");
      return failure;
    }

    await auditLogger.log({
      db: client,
      userId,
      eventType: "MFA_SUCCESS",
      action: "MFA verified",
      severity: "low",
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    const response = await issueSessionTokens(
      client,
      userId,
      user.role || "user",
      context,
      "User authenticated with MFA"
    );

    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function refreshSession(refreshToken, context) {
  const normalizedRefreshToken = normalizeTokenValue(refreshToken);

  if (!normalizedRefreshToken) {
    await auditLogger.log({
      userId: null,
      eventType: 'REFRESH_TOKEN_FAILED',
      action: 'Refresh token missing',
      severity: 'medium',
      status: 'failure',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    return buildFailure('INVALID_REFRESH_TOKEN');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const refreshRecord = await findRefreshTokenRecord(client, normalizedRefreshToken, {
      forUpdate: true
    });

    if (!refreshRecord || !refreshRecord.is_active) {
      await auditLogger.log({
        db: client,
        userId: refreshRecord?.user_id || null,
        eventType: 'REFRESH_TOKEN_FAILED',
        action: 'Invalid refresh token',
        severity: 'medium',
        status: 'failure',
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId
      });

      await client.query('COMMIT');
      return buildFailure('INVALID_REFRESH_TOKEN');
    }

    await client.query(
      'DELETE FROM refresh_tokens WHERE id = $1',
      [refreshRecord.id]
    );

    const tokens = tokenService.generateTokens(
      refreshRecord.user_id,
      refreshRecord.role || 'user'
    );

    await persistRefreshToken(client, refreshRecord.user_id, tokens.refreshToken);

    await auditLogger.log({
      db: client,
      userId: refreshRecord.user_id,
      eventType: 'REFRESH_TOKEN_USED',
      action: 'Refresh token rotated',
      severity: 'low',
      status: 'success',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    await client.query('COMMIT');

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function logoutSession(refreshToken, context) {
  const normalizedRefreshToken = normalizeTokenValue(refreshToken);

  if (!normalizedRefreshToken) {
    await auditLogger.log({
      userId: null,
      eventType: 'REFRESH_TOKEN_REVOKED',
      action: 'Logout completed without refresh token payload',
      severity: 'low',
      status: 'success',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    return {
      success: true,
      message: 'Logged out'
    };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const refreshRecord = await findRefreshTokenRecord(client, normalizedRefreshToken, {
      forUpdate: true
    });

    await client.query(
      'DELETE FROM refresh_tokens WHERE token_hash = $1',
      [tokenService.hashRefreshToken(normalizedRefreshToken)]
    );

    await auditLogger.log({
      db: client,
      userId: refreshRecord?.user_id || null,
      eventType: 'REFRESH_TOKEN_REVOKED',
      action: 'Refresh token revoked during logout',
      severity: 'low',
      status: 'success',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Logged out'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function activateMfa(userId, token, context, preAuthToken) {
  return verifyMfaSetup(userId, token, context, preAuthToken);
}

// FIXED
async function unlockUser(userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureSecurityRecord(client, userId, { forUpdate: true });
    await client.query(
      `UPDATE user_security
       SET account_locked = FALSE,
           failed_login_attempts = 0
       WHERE user_id = $1`,
      [userId]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  login,
  setupMfa,
  verifyMfaSetup,
  verifyOtp,
  activateMfa,
  refreshSession,
  logoutSession,
  unlockUser
};
