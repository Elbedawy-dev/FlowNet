import { Router } from 'express';
import { getRealtimeToken } from '../controllers/realtime.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/token', requireAuth, getRealtimeToken);

export default router;
