const pool = require('../config/db');

/* ------------------------------------------------ */
/* NORMALIZE INPUT */
/* ------------------------------------------------ */

function normalizeAuditArgs(args) {

  if (args.length === 1 && typeof args[0] === 'object') {
    return args[0];
  }

  const [
    dbOrPool,
    userId,
    action,
    status,
    ip,
    userAgent,
    metadata
  ] = args;

  return {
    db: dbOrPool,
    userId,
    action,
    eventType: action,
    severity: status === 'failure' ? 'high' : 'low',
    status,
    ip,
    userAgent,
    metadata: metadata || {}
  };
}

/* ------------------------------------------------ */
/* VALIDATE SEVERITY */
/* ------------------------------------------------ */

function normalizeSeverity(severity) {

  const allowed = ['low', 'medium', 'high', 'critical'];

  if (!severity || !allowed.includes(severity)) {
    return 'low';
  }

  return severity;
}

/* ------------------------------------------------ */
/* AUDIT LOGGER */
/* ------------------------------------------------ */

async function logAudit(...args) {

  const {
    db,
    userId = null,
    action = 'unknown_action',
    eventType = action,
    severity = 'low',
    status = 'success',
    ip = null,
    userAgent = null,
    requestId = null,
    eventTimestamp = new Date(),
    metadata = {}
  } = normalizeAuditArgs(args);

  const client = db || pool;
  const enrichedMetadata = {
    // Added: keep a normalized security audit summary alongside the table columns.
    loggedAt: eventTimestamp,
    userId,
    action,
    ip,
    ...metadata
  };

  try {

    await client.query(
        `
        INSERT INTO audit_logs (
          user_id,
          action,
          status,
          event_type,
          severity,
          ip,
          user_agent,
          request_id,
          metadata,
          event_timestamp
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
        [
          userId,
          action,
          status,
          eventType,
          normalizeSeverity(severity),
          ip,
          userAgent,
          requestId,
          enrichedMetadata,
          eventTimestamp
        ]
    );

  } catch (error) {

    /* ------------------------------------------------ */
    /* BACKWARD COMPATIBILITY FOR OLD SCHEMA */
    /* ------------------------------------------------ */

    if (['42703', '42P01'].includes(error.code)) {

      try {

        await client.query(
            `
          INSERT INTO audit_logs (
            user_id,
            action,
            status,
            ip_address,
            user_agent,
            metadata
          )
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
            [
              userId,
              action,
              status,
              ip,
              userAgent,
              enrichedMetadata
            ]
        );

      } catch (fallbackError) {

        console.error(
            'Audit logger fallback failed:',
            fallbackError.message
        );

      }

      return;
    }

    /* ------------------------------------------------ */
    /* NEVER BREAK MAIN APPLICATION */
    /* ------------------------------------------------ */

    console.error(
        'Audit logger error:',
        error.message
    );

  }

}

module.exports = {
  log: logAudit,
  logAudit
};
