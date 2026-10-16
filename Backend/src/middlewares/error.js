import { ApiError } from '../utils/apiError.js';
import multer from 'multer';

/**
 * 404 Not Found Middleware
 */
export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central Error Handling Middleware
 * Guarantees standard envelope: { success: false, message, code, errors? }
 * Never leaks stack traces or user emails
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal error occurred';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = err.errors;

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    if (field === 'username') {
      code = 'USERNAME_TAKEN';
      message = 'Username is already taken';
    } else {
      code = 'CONFLICT';
      message = `${field || 'Field'} already exists`;
    }
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier format for ${err.path}`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = 'Validation failed';
  }

  // Handle Multer upload errors
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed file size';
      code = 'FILE_TOO_LARGE';
    } else {
      message = err.message;
    }
  }

  // Log server errors for monitoring
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
    message = 'An unexpected internal error occurred';
  }

  const response = {
    success: false,
    message,
    code,
  };

  if (errors && Array.isArray(errors) && errors.length > 0) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
};
