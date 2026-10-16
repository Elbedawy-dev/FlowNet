import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const createLimiter = ({ windowMs, max, message, code = 'RATE_LIMIT_EXCEEDED' }) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
      code,
    },
    keyGenerator: (req) => {
      // Rate limit per authenticated user if available, fallback to IP with IPv6 support
      if (req.userId) {
        return `user:${req.userId}`;
      }
      return ipKeyGenerator(req);
    },
    validate: {
      keyGeneratorIpFallback: false,
    },
  });
};

// General rate limiter: 100 requests per 15 minutes
export const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again after 15 minutes',
});

// Messages rate limiter: 30 requests per minute
export const messageLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Message rate limit exceeded. Please wait a moment before sending more messages.',
  code: 'MESSAGE_RATE_LIMIT',
});

// Uploads rate limiter: 20 requests per minute
export const uploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Upload rate limit exceeded. Please wait before uploading more media.',
  code: 'UPLOAD_RATE_LIMIT',
});

// Connection requests rate limiter: 50 requests per day
export const connectionRequestLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  message: 'Daily connection requests limit (50) reached. Try again tomorrow.',
  code: 'CONNECTION_LIMIT_EXCEEDED',
});
