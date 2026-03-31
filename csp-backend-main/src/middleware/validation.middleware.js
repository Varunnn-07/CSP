const AppError = require('../utils/appError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);

    if (!parsed.success) {
      return next(new AppError(
        'Invalid request payload',
        400,
        'VALIDATION_ERROR'
      ));
    }

    req[source] = parsed.data;
    next();
  };
}

module.exports = validate;
