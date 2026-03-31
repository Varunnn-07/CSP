class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'SERVER_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

module.exports = AppError;
