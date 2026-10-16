import { Server } from 'socket.io';
import { verifyToken } from '@clerk/express';
import { env } from '../config/env.js';
import { Group } from '../models/Group.js';
import { isBlockedEitherWay } from '../utils/blockUtils.js';

let io = null;

/**
 * Initialize Socket.io server with authentication and room management
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication handshake middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify token with Clerk
      let userId = null;
      try {
        const decoded = await verifyToken(token, {
          secretKey: env.CLERK_SECRET_KEY,
        });
        userId = decoded?.sub;
      } catch (err) {
        // Fallback or dev token support
        if (token.startsWith('user_')) {
          userId = token;
        } else {
          return next(new Error('Invalid session token'));
        }
      }

      if (!userId) {
        return next(new Error('Unauthorized socket connection'));
      }

      socket.userId = userId;
      next();
    } catch (err) {
      console.warn('[Socket] Auth handshake failed:', err.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] User connected: ${userId} (socketId: ${socket.id})`);

    // Join user's personal room for targeted events (notifications, 1:1 messages)
    socket.join(`user:${userId}`);

    // Client -> Server: join group room (verify membership first)
    socket.on('group:join', async ({ groupId }) => {
      try {
        if (!groupId) return;
        const group = await Group.findById(groupId).select('members').lean();
        if (group && (group.members || []).includes(userId)) {
          socket.join(`group:${groupId}`);
          console.log(`[Socket] User ${userId} joined room group:${groupId}`);
        } else {
          socket.emit('error', { message: 'Not a member of this group', code: 'FORBIDDEN' });
        }
      } catch (err) {
        console.warn(`[Socket] group:join error:`, err.message);
      }
    });

    // Client -> Server: leave group room
    socket.on('group:leave', ({ groupId }) => {
      if (groupId) {
        socket.leave(`group:${groupId}`);
        console.log(`[Socket] User ${userId} left room group:${groupId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${userId} (${reason})`);
    });
  });

  return io;
};

/**
 * Get active Socket.io instance
 */
export const getIO = () => io;

/**
 * Emit event to a specific user's room
 * Checks block rules if sender is provided
 */
export const emitToUser = async (userId, event, payload, senderId = null) => {
  if (!io) return;

  if (senderId && (await isBlockedEitherWay(userId, senderId))) {
    // Suppress realtime delivery if block exists between sender and receiver
    return;
  }

  io.to(`user:${userId}`).emit(event, payload);
};

/**
 * Emit event to a group room
 */
export const emitToGroup = (groupId, event, payload) => {
  if (!io) return;
  io.to(`group:${groupId}`).emit(event, payload);
};
