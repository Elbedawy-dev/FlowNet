export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - User-friendly error message
   * @param {string} code - Machine-readable error code (e.g. BLOCKED_BY_USER)
   * @param {Array} errors - Optional validation errors or details
   */
  constructor(statusCode, message, code = 'INTERNAL_ERROR', errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', errors = []) {
    return new ApiError(400, message, code, errors);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Forbidden action', code = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }

  static conflict(message = 'Resource conflict', code = 'CONFLICT') {
    return new ApiError(409, message, code);
  }

  static blockedByUser(message = 'Action blocked by user privacy rules', code = 'BLOCKED_BY_USER') {
    return new ApiError(403, message, code);
  }

  static messagingRestricted(message = 'Only connections can send messages to this user', code = 'MESSAGING_RESTRICTED') {
    return new ApiError(403, message, code);
  }

  static featureDisabled(message = 'This feature is currently disabled', code = 'FEATURE_DISABLED') {
    return new ApiError(403, message, code);
  }

  static validationError(message = 'Validation failed', errors = []) {
    return new ApiError(422, message, 'VALIDATION_ERROR', errors);
  }
}
