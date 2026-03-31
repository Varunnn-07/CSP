const dns = require('dns').promises;
const net = require('net');
const AppError = require('../utils/appError');

const blockedHostnames = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0'
]);

function isPrivateIpv4(ip) {
  if (!net.isIP(ip) || net.isIP(ip) !== 4) {
    return false;
  }

  const [a, b] = ip.split('.').map(Number);

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
}

function isPrivateIpv6(ip) {
  if (!net.isIP(ip) || net.isIP(ip) !== 6) {
    return false;
  }

  const normalized = ip.toLowerCase();

  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
}

function isBlockedIp(ip) {
  return isPrivateIpv4(ip) || isPrivateIpv6(ip);
}

async function assertSafeExternalUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError('Invalid URL format', 400, 'INVALID_URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new AppError('Only HTTPS URLs are allowed', 400, 'INSECURE_URL_PROTOCOL');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (blockedHostnames.has(hostname) || hostname.endsWith('.local')) {
    throw new AppError('URL host is not allowed', 400, 'BLOCKED_URL_HOST');
  }

  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    throw new AppError('Internal IP ranges are blocked', 400, 'BLOCKED_INTERNAL_IP');
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: false });
  const hasInternalTarget = records.some((record) => isBlockedIp(record.address));

  if (hasInternalTarget) {
    throw new AppError('Resolved URL points to internal network', 400, 'BLOCKED_INTERNAL_IP');
  }

  return parsed.toString();
}

module.exports = {
  assertSafeExternalUrl
};
