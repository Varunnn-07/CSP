require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const ENABLE_HTTPS = ['1', 'true', 'yes'].includes(
    String(process.env.ENABLE_HTTPS || '').toLowerCase()
);

const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);

/* ------------------------------------------------ */
/* HTTPS CERT HELPERS */
/* ------------------------------------------------ */

function resolveCertificatePath(filePath) {
  if (!filePath) return null;
  return path.resolve(__dirname, '..', filePath);
}

function loadHttpsCredentials() {
  const keyPath = resolveCertificatePath(
      process.env.HTTPS_KEY_PATH || 'certs/localhost-key.pem'
  );

  const certPath = resolveCertificatePath(
      process.env.HTTPS_CERT_PATH || 'certs/localhost-cert.pem'
  );

  if (!keyPath || !certPath) return null;
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) return null;

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

/* ------------------------------------------------ */
/* START HTTP SERVER */
/* ------------------------------------------------ */

http.createServer(app).listen(PORT, HOST, () => {
  console.log(`🚀 CSP backend running on port ${PORT}`);
});

/* ------------------------------------------------ */
/* OPTIONAL HTTPS (LOCAL DEV ONLY) */
/* ------------------------------------------------ */

if (ENABLE_HTTPS) {
  const credentials = loadHttpsCredentials();

  if (!credentials) {
    console.warn('⚠️ HTTPS requested but certs not found — using HTTP only');
  } else if (HTTPS_PORT === Number(PORT)) {
    console.warn('⚠️ HTTPS_PORT same as PORT — skipping HTTPS');
  } else {
    https.createServer(credentials, app).listen(HTTPS_PORT, HOST, () => {
      console.log(`🔐 HTTPS running on port ${HTTPS_PORT}`);
    });
  }
}