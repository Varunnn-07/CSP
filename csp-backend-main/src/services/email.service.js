const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER;

async function sendOtpEmail(toEmail, otp) {
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Your CSP OTP Code',
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It will expire in 5 minutes.</p>`
  });
}

async function sendLoginWarningEmail(toEmail, attempts) {
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'CSP Security Alert: Multiple Failed Login Attempts',
    text: `We detected ${attempts} failed login attempts on your account. If this was not you, reset your password immediately.`,
    html: `<p>We detected <strong>${attempts} failed login attempts</strong> on your account.</p><p>If this was not you, reset your password immediately.</p>`
  });
}

module.exports = {
  sendOtpEmail,
  sendLoginWarningEmail
};
