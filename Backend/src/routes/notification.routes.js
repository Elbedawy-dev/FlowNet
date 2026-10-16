import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';

const router = Router();

router.use(requireAuth, ensureUser);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read', markAllAsRead);
router.put('/:id/read', markAsRead);

export default router;
