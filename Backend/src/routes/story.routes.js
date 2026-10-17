import { Router } from 'express';
import {
  createStory,
  updateStory,
  getStories,
  viewStory,
  deleteStory,
} from '../controllers/story.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { uploadStoryMedia } from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.use(requireAuth, ensureUser);

router.post('/', uploadLimiter, uploadStoryMedia, createStory);
router.get('/', getStories);
router.put('/:id', updateStory);
router.post('/:id/view', viewStory);
router.delete('/:id', deleteStory);

export default router;
