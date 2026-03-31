const nodemailer = require("nodemailer");

/* ------------------------------------------------ */
/* CREATE MAIL TRANSPORT */
/* ------------------------------------------------ */

function createAlertTransport() {

  const user = process.env.ALERT_EMAIL;
  const pass = process.env.ALERT_EMAIL_PASSWORD;

  if (!user || !pass) {
    console.warn("Email alerts disabled: ALERT_EMAIL not configured.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true
    }
  });

}

/* ------------------------------------------------ */
/* ACCOUNT LOCK ALERT */
/* ------------------------------------------------ */

async function sendAccountLockedEmail(toEmail) {

  const transporter = createAlertTransport();
  if (!transporter) return;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: toEmail,
    subject: "Security Alert: Account Locked",
    text:
        "Your account has been locked due to multiple failed login attempts. Please contact support to unlock your account.",
    html: `
      <h3>Security Alert</h3>
      <p>Your account has been locked due to multiple failed login attempts.</p>
      <p>Please contact support to unlock your account.</p>
    `
  });

}

/* ------------------------------------------------ */
/* SUSPICIOUS LOGIN ALERT */
/* ------------------------------------------------ */

async function sendSuspiciousLoginEmail(toEmail, country, ip) {

  const transporter = createAlertTransport();
  if (!transporter) return;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: toEmail,
    subject: "Security Alert: Suspicious Login Detected",
    text:
        `A login attempt was detected from ${country} (IP: ${ip}). If this was not you, please secure your account.`,
    html: `
      <h3>Suspicious Login Detected</h3>
      <p>A login was detected from a new location:</p>
      <ul>
        <li><strong>Country:</strong> ${country}</li>
        <li><strong>IP Address:</strong> ${ip}</li>
      </ul>
      <p>If this activity was not performed by you, please change your password immediately.</p>
    `
  });

}

/* ------------------------------------------------ */
/* IP BLOCK ALERT (OPTIONAL SECURITY FEATURE) */
/* ------------------------------------------------ */

async function sendIpBlockedAlert(adminEmail, ip) {

  const transporter = createAlertTransport();
  if (!transporter) return;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: adminEmail,
    subject: "Security Alert: IP Address Blocked",
    text:
        `The IP address ${ip} has been blocked due to repeated failed login attempts.`,
    html: `
      <h3>Security Alert</h3>
      <p>The following IP address has been blocked due to suspicious activity:</p>
      <p><strong>${ip}</strong></p>
    `
  });

}

/* ------------------------------------------------ */

module.exports = {
  sendAccountLockedEmail,
  sendSuspiciousLoginEmail,
  sendIpBlockedAlert
};
