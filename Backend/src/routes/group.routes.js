import { Router } from 'express';
import {
  createGroup,
  getAvailableGroups,
  getJoinedGroups,
  getMyGroups,
  getGroupById,
  requestToJoinGroup,
  cancelJoinRequest,
  getGroupRequests,
  acceptJoinRequest,
  rejectJoinRequest,
  removeMember,
  getGroupMessages,
  sendGroupMessage,
  createGroupSchema,
} from '../controllers/group.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUser } from '../middlewares/ensureUser.js';
import { validate } from '../middlewares/validate.js';
import { uploadGroupMessageMedia } from '../middlewares/upload.js';

const router = Router();

router.use(requireAuth, ensureUser);

// Group listings
router.get('/available', getAvailableGroups);
router.get('/joined', getJoinedGroups);
router.get('/mine', getMyGroups);

// Create group (feature flag gated)
router.post('/', validate({ body: createGroupSchema }), createGroup);

// Single group & membership requests
router.get('/:id', getGroupById);
router.post('/:id/join-request', requestToJoinGroup);
router.delete('/:id/join-request', cancelJoinRequest);

// Admin / Owner request management
router.get('/:id/requests', getGroupRequests);
router.post('/:id/requests/:userId/accept', acceptJoinRequest);
router.post('/:id/requests/:userId/reject', rejectJoinRequest);
router.delete('/:id/members/:userId', removeMember);

// Group chat
router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', uploadGroupMessageMedia, sendGroupMessage);

export default router;
