class AppError extends Error {
  constructor(httpStatus, code, message, details) {
    super(message);
    this.name = "AppError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

const ERROR_CODES = {
  VALIDATION_ERROR: 40001,
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  INTERNAL_ERROR: 50001,
};

module.exports = {
  AppError,
  ERROR_CODES,
};
