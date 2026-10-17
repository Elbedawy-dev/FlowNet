import http from 'http';
import mongoose from 'mongoose';
import app from './src/app.js';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { initSocket } from './src/sockets/index.js';

let server = null;

// On serverless environments like Vercel, Socket.io cannot maintain persistent WebSocket
// connections and app.listen should not be called. For local development or platforms like
// Render / Railway, we create the HTTP server and attach Socket.io.
if (!process.env.VERCEL) {
  server = http.createServer(app);

  // Initialize Socket.io
  initSocket(server);

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
}

export { app, server };
export default app;
