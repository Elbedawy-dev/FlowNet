import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  searchUsers,
  getUserProfile,
  getUserPosts,
  getMyNetwork,
  getMyBlockedUsers,
  updateSettings,
  deactivateAccount,
  deleteMyAccount,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  updateProfileSchema,
  updateSettingsSchema,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { validate } from '../middlewares/validate.js';
import { uploadProfileAndCover } from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// All user routes require authentication and user synchronization
router.use(requireAuth, ensureUser);

// Current user profile and settings
router.get('/me', getMyProfile);
router.put('/me', uploadLimiter, uploadProfileAndCover, validate({ body: updateProfileSchema }), updateMyProfile);
router.get('/me/network', getMyNetwork);
router.get('/me/blocked', getMyBlockedUsers);
router.put('/me/settings', validate({ body: updateSettingsSchema }), updateSettings);
router.put('/me/deactivate', deactivateAccount);
router.delete('/me', deleteMyAccount);

// Search users
router.get('/search', searchUsers);

// Specific user actions & details
router.get('/:id', getUserProfile);
router.get('/:id/posts', getUserPosts);
router.post('/:id/follow', followUser);
router.delete('/:id/follow', unfollowUser);
router.post('/:id/block', blockUser);
router.delete('/:id/block', unblockUser);

export default router;
