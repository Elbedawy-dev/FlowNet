import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createGroup,
  getAvailableGroups,
  getJoinedGroups,
  getMyGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  requestToJoinGroup,
  cancelJoinRequest,
  getGroupRequests,
  acceptJoinRequest,
  rejectJoinRequest,
  leaveGroup,
  removeMember,
  getGroupMessages,
  sendGroupMessage,
  createGroupSchema,
  updateGroupSchema,
} from '../controllers/group.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { validate } from '../middlewares/validate.js';
import { uploadGroupMessageMedia } from '../middlewares/upload.js';

const router = Router();

// Rate limit group creation to 3 per hour per user
const createGroupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Rate limit exceeded: You can only create up to 3 groups per hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
});

router.use(requireAuth, ensureUser);

// Group listings
router.get('/available', getAvailableGroups);
router.get('/joined', getJoinedGroups);
router.get('/mine', getMyGroups);

// Create group (enabled for all users, rate-limited to 3/hour)
router.post(
  '/',
  createGroupLimiter,
  validate({ body: createGroupSchema }),
  createGroup
);

// Single group CRUD & actions
router.get('/:id', getGroupById);
router.put('/:id', validate({ body: updateGroupSchema }), updateGroup);
router.delete('/:id', deleteGroup);

// Membership request lifecycle
router.post('/:id/join-request', requestToJoinGroup);
router.delete('/:id/join-request', cancelJoinRequest);

// Owner / Admin request management
router.get('/:id/requests', getGroupRequests);
router.post('/:id/requests/:userId/accept', acceptJoinRequest);
router.post('/:id/requests/:userId/reject', rejectJoinRequest);

// Membership management
router.post('/:id/leave', leaveGroup);
router.delete('/:id/members/:userId', removeMember);

// Group chat messages
router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', uploadGroupMessageMedia, sendGroupMessage);

export default router;
