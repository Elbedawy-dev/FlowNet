import { getAuth } from '@clerk/express';
import { ApiError } from '../utils/apiError.js';

/**
 * Require valid Clerk authentication
 * Populates req.userId with authenticated Clerk user ID
 */
export const requireAuth = (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return next(ApiError.unauthorized('Authentication required', 'UNAUTHORIZED'));
    }
    req.userId = auth.userId;
    next();
  } catch (error) {
    next(ApiError.unauthorized('Invalid authentication token', 'UNAUTHORIZED'));
  }
};
