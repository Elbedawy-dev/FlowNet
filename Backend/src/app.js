import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/index.js';
import { generalLimiter } from './middlewares/rateLimit.js';
import { notFoundHandler, errorHandler } from './middlewares/error.js';

const app = express();

// Security & performance middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman) or matching CLIENT_URL
      if (!origin || env.CLIENT_URL.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'svix-id', 'svix-timestamp', 'svix-signature'],
  })
);
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parse JSON and retain raw body for svix webhook signature verification
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure MongoDB is connected before handling requests (cached across serverless invocations)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    if (req.path === '/health' || req.path === '/api/health') {
      return next();
    }
    next(err);
  }
});

// Apply general rate limiter
app.use('/api', generalLimiter);

// Clerk authentication middleware (populates req.auth)
app.use(
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  })
);

// Public root health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
  });
});

// Mount all API routes under /api
app.use('/api', apiRoutes);

// 404 & Central Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
export { app };
