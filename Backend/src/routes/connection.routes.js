import { Router } from 'express';
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  removeConnection,
} from '../controllers/connection.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { connectionRequestLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.use(requireAuth, ensureUser);

router.post('/:userId/request', connectionRequestLimiter, sendConnectionRequest);
router.post('/:userId/accept', acceptConnectionRequest);
router.post('/:userId/reject', rejectConnectionRequest);
router.delete('/:userId', removeConnection);

export default router;
