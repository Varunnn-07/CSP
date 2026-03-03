const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        errorCode: "VALIDATION_ERROR"
      });
    }

    next();
  };
}

module.exports = validate;
