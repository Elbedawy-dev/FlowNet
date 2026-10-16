import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { initSocket } from './src/sockets/index.js';
import apiRoutes from './src/routes/index.js';
import { generalLimiter } from './src/middlewares/rateLimit.js';
import { notFoundHandler, errorHandler } from './src/middlewares/error.js';
import mongoose from 'mongoose';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

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
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Mount all API routes under /api
app.use('/api', apiRoutes);

// 404 & Central Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`[Server] Received ${signal}. Closing gracefully...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await mongoose.connection.close(false);
      console.log('[MongoDB] Connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('[MongoDB] Error during disconnect:', err.message);
      process.exit(1);
    }
  });

  // Force shutdown after timeout if hanging
  setTimeout(() => {
    console.error('[Server] Forcefully terminating after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server after connecting to database
const startServer = async () => {
  await connectDB();
  server.listen(env.PORT, () => {
    console.log(`🚀 FlowNet Backend listening on http://localhost:${env.PORT}`);
    console.log(`🌐 Allowed client origins: ${env.CLIENT_URL.join(', ')}`);
  });
};

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});

export { app, server };
