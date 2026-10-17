import { Router } from 'express';
import {
  createPost,
  updatePost,
  getFeed,
  getPostById,
  deletePost,
  toggleLike,
  sharePost,
  getPostComments,
  addComment,
  deleteComment,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
} from '../controllers/post.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { validate } from '../middlewares/validate.js';
import { uploadPostImages } from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.use(requireAuth, ensureUser);

// Post creation & feed
router.post('/', uploadLimiter, uploadPostImages, validate({ body: createPostSchema }), createPost);
router.get('/feed', getFeed);

// Single post operations
router.get('/:id', getPostById);
router.put('/:id', uploadLimiter, uploadPostImages, validate({ body: updatePostSchema }), updatePost);
router.delete('/:id', deletePost);
router.post('/:id/like', toggleLike);
router.post('/:id/share', sharePost);

// Comments
router.get('/:id/comments', getPostComments);
router.post('/:id/comments', validate({ body: createCommentSchema }), addComment);
router.delete('/:id/comments/:commentId', deleteComment);

export default router;
