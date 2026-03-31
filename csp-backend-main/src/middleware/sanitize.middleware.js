const sanitizeHtml = require('sanitize-html');

const SANITIZE_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {}
};

function sanitizeText(value) {
  return sanitizeHtml(value, SANITIZE_OPTIONS).trim();
}

// Added: strip HTML/script payloads from free-text inputs before they reach DB-facing code.
function sanitizeFields(fields, source = 'body') {
  return (req, res, next) => {
    const payload = req[source];

    if (!payload || typeof payload !== 'object') {
      return next();
    }

    for (const field of fields) {
      if (typeof payload[field] === 'string') {
        payload[field] = sanitizeText(payload[field]);
      }
    }

    return next();
  };
}

module.exports = {
  sanitizeFields,
  sanitizeText
};
