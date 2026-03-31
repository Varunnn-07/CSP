const { randomUUID } = require('crypto');

function requestIdMiddleware(req, res, next) {
  const requestIdHeader = req.headers['x-request-id'];
  const headerValue = typeof requestIdHeader === 'string' ? requestIdHeader.trim() : '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(headerValue);
  const requestId = isUuid ? headerValue : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = requestIdMiddleware;
