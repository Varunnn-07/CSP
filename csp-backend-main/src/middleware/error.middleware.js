const AppError = require('../utils/appError');

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload',
      errorCode: 'MALFORMED_JSON'
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    errorCode: 'SERVER_ERROR'
  });
}

module.exports = errorHandler;
