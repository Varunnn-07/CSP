const net = require('net');

function normalizeClientIp(rawIp) {
  if (!rawIp) {
    return 'unknown';
  }

  const normalized = String(rawIp).trim().replace(/^\[|\]$/g, '');

  if (!normalized) {
    return 'unknown';
  }

  const withoutMappedPrefix = normalized.startsWith('::ffff:')
    ? normalized.slice(7)
    : normalized;

  return net.isIP(withoutMappedPrefix) ? withoutMappedPrefix : 'unknown';
}

function parseForwardedIp(rawHeader) {
  if (typeof rawHeader !== 'string' || !rawHeader.trim()) {
    return 'unknown';
  }

  return normalizeClientIp(rawHeader.split(',')[0]);
}

// Added: keep auth logging and blocked IP checks aligned on the same client IP value.
function getClientIp(req) {
  if (req?.app?.get('trust proxy')) {
    const trustedProxyIp = normalizeClientIp(req.ip);

    if (trustedProxyIp !== 'unknown') {
      return trustedProxyIp;
    }
  }

  const directIp = normalizeClientIp(
    req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress
  );

  if (directIp !== 'unknown') {
    return directIp;
  }

  return parseForwardedIp(req?.headers?.['x-forwarded-for']);
}

module.exports = {
  getClientIp,
  normalizeClientIp
};
