import { Router } from 'express';
import userRoutes from './user.routes.js';
import connectionRoutes from './connection.routes.js';
import postRoutes from './post.routes.js';
import storyRoutes from './story.routes.js';
import messageRoutes from './message.routes.js';
import notificationRoutes from './notification.routes.js';
import groupRoutes from './group.routes.js';
import webhookRoutes from './webhook.routes.js';
import realtimeRoutes from './realtime.routes.js';

const router = Router();

// Public health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
  });
});

// Clerk webhooks (public with signature verification)
router.use('/webhooks', webhookRoutes);

// Protected application routes
router.use('/users', userRoutes);
router.use('/connections', connectionRoutes);
router.use('/posts', postRoutes);
router.use('/stories', storyRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/groups', groupRoutes);
router.use('/realtime', realtimeRoutes);

export default router;
