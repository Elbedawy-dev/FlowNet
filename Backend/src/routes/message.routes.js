import { Router } from 'express';
import {
  getRecentMessages,
  getConversation,
  sendMessage,
  markMessagesSeen,
} from '../controllers/message.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { uploadMessageMedia } from '../middlewares/upload.js';
import { messageLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.use(requireAuth, ensureUser);

router.get('/recent', getRecentMessages);
router.get('/:userId', getConversation);
router.post('/:userId', messageLimiter, uploadMessageMedia, sendMessage);
router.put('/:userId/seen', markMessagesSeen);

export default router;
