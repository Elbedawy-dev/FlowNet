import { z } from 'zod';
import { Group } from '../models/Group.js';
import { GroupMessage } from '../models/GroupMessage.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { uploadFromBuffer } from '../config/cloudinary.js';
import { parseCursorPagination, buildCursorResult } from '../utils/pagination.js';
import { emitToGroup, emitToUser } from '../sockets/index.js';
import { createNotification } from './notification.controller.js';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(100),
  icon: z.enum(['users', 'rocket', 'globe', 'sparkles', 'star']).default('users'),
  description: z.string().max(1000).optional(),
});

/**
 * POST /api/groups
 * Create group (gated by ALLOW_GROUP_CREATION feature flag)
 */
export const createGroup = asyncHandler(async (req, res) => {
  if (!env.ALLOW_GROUP_CREATION) {
    throw ApiError.featureDisabled('Group creation is currently disabled', 'FEATURE_DISABLED');
  }

  const currentUserId = req.userId;
  const { name, icon, description } = req.body;

  const group = await Group.create({
    name,
    icon: icon || 'users',
    description: description || '',
    owner: currentUserId,
    admins: [currentUserId],
    members: [currentUserId],
    pending_requests: [],
  });

  res.status(201).json({
    success: true,
    data: group,
  });
});

/**
 * GET /api/groups/available
 * Groups where current user is NOT a member, with has_pending_request flag
 */
export const getAvailableGroups = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;

  const groups = await Group.find({ members: { $ne: currentUserId } })
    .populate('owner', '_id full_name username profile_picture')
    .sort({ createdAt: -1 })
    .lean();

  const formatted = groups.map((g) => ({
    _id: g._id,
    name: g.name,
    icon: g.icon,
    description: g.description,
    owner: g.owner,
    members_count: (g.members || []).length,
    has_pending_request: (g.pending_requests || []).includes(currentUserId),
    createdAt: g.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: formatted,
  });
});

/**
 * GET /api/groups/joined
 * Groups where current user is a member
 */
export const getJoinedGroups = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;

  const groups = await Group.find({ members: currentUserId })
    .populate('owner', '_id full_name username profile_picture')
    .sort({ createdAt: -1 })
    .lean();

  const formatted = groups.map((g) => ({
    _id: g._id,
    name: g.name,
    icon: g.icon,
    description: g.description,
    owner: g.owner,
    members_count: (g.members || []).length,
    is_owner: g.owner?._id === currentUserId || g.owner === currentUserId,
    is_admin: (g.admins || []).includes(currentUserId),
    createdAt: g.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: formatted,
  });
});

/**
 * GET /api/groups/mine
 * Groups owned or administrated by current user
 */
export const getMyGroups = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;

  const groups = await Group.find({
    $or: [{ owner: currentUserId }, { admins: currentUserId }],
  })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: groups,
  });
});

/**
 * GET /api/groups/:id
 * Get single group details
 */
export const getGroupById = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const group = await Group.findById(req.params.id)
    .populate('owner', '_id full_name username profile_picture')
    .lean();

  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  const isMember = (group.members || []).includes(currentUserId);
  const isAdmin = (group.admins || []).includes(currentUserId);
  const hasPending = (group.pending_requests || []).includes(currentUserId);

  res.status(200).json({
    success: true,
    data: {
      ...group,
      is_member: isMember,
      is_admin: isAdmin,
      has_pending_request: hasPending,
      members_count: (group.members || []).length,
    },
  });
});

/**
 * POST /api/groups/:id/join-request
 * Request to join a group
 */
export const requestToJoinGroup = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const group = await Group.findById(req.params.id);

  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  if (group.members.includes(currentUserId)) {
    throw ApiError.conflict('You are already a member of this group');
  }

  if (group.pending_requests.includes(currentUserId)) {
    throw ApiError.conflict('Join request already pending');
  }

  group.pending_requests.push(currentUserId);
  await group.save();

  // Notify owner
  await createNotification({
    user: group.owner,
    actor: currentUserId,
    type: 'group_join_request',
  });

  // Emit realtime notification to group owner room
  await emitToUser(group.owner, 'group:request', {
    groupId: group._id,
    userId: currentUserId,
  });

  res.status(200).json({
    success: true,
    message: 'Join request submitted',
  });
});

/**
 * DELETE /api/groups/:id/join-request
 * Cancel a pending join request
 */
export const cancelJoinRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const group = await Group.findById(req.params.id);

  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  group.pending_requests = group.pending_requests.filter((id) => id !== currentUserId);
  await group.save();

  res.status(200).json({
    success: true,
    message: 'Join request cancelled',
  });
});

/**
 * GET /api/groups/:id/requests
 * Get list of pending requests for group (Owner or Admin only)
 */
export const getGroupRequests = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const group = await Group.findById(req.params.id).lean();

  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  const isOwnerOrAdmin = group.owner === currentUserId || (group.admins || []).includes(currentUserId);
  if (!isOwnerOrAdmin) {
    throw ApiError.forbidden('Only group owners or admins can review join requests');
  }

  const pendingUsers = await User.find({ _id: { $in: group.pending_requests || [] } })
    .select('_id full_name username profile_picture bio')
    .lean();

  res.status(200).json({
    success: true,
    data: pendingUsers,
  });
});

/**
 * POST /api/groups/:id/requests/:userId/accept
 * Accept a join request (Owner or Admin only)
 */
export const acceptJoinRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { id: groupId, userId: targetUserId } = req.params;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  const isOwnerOrAdmin = group.owner === currentUserId || group.admins.includes(currentUserId);
  if (!isOwnerOrAdmin) {
    throw ApiError.forbidden('Only group owners or admins can accept requests');
  }

  if (!group.pending_requests.includes(targetUserId)) {
    throw ApiError.notFound('Join request not found');
  }

  // Move from pending_requests to members
  group.pending_requests = group.pending_requests.filter((id) => id !== targetUserId);
  if (!group.members.includes(targetUserId)) {
    group.members.push(targetUserId);
  }
  await group.save();

  // Notify user
  await createNotification({
    user: targetUserId,
    actor: currentUserId,
    type: 'group_request_accepted',
  });

  await emitToUser(targetUserId, 'group:request_accepted', {
    groupId: group._id,
    groupName: group.name,
  });

  res.status(200).json({
    success: true,
    message: 'User accepted into group',
  });
});

/**
 * POST /api/groups/:id/requests/:userId/reject
 * Reject a join request (Owner or Admin only)
 */
export const rejectJoinRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { id: groupId, userId: targetUserId } = req.params;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  const isOwnerOrAdmin = group.owner === currentUserId || group.admins.includes(currentUserId);
  if (!isOwnerOrAdmin) {
    throw ApiError.forbidden('Only group owners or admins can reject requests');
  }

  group.pending_requests = group.pending_requests.filter((id) => id !== targetUserId);
  await group.save();

  res.status(200).json({
    success: true,
    message: 'Join request rejected',
  });
});

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove member or leave group
 */
export const removeMember = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { id: groupId, userId: targetUserId } = req.params;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  const isSelfLeaving = targetUserId === currentUserId;
  const isOwnerOrAdmin = group.owner === currentUserId || group.admins.includes(currentUserId);

  if (!isSelfLeaving && !isOwnerOrAdmin) {
    throw ApiError.forbidden('You do not have permission to remove this member');
  }

  // If owner is leaving, they cannot leave if there are other members without transferring ownership
  if (group.owner === targetUserId) {
    if (group.members.length > 1) {
      // Transfer ownership to next admin or member
      const newOwner = group.admins.find((id) => id !== targetUserId) || group.members.find((id) => id !== targetUserId);
      group.owner = newOwner;
    } else {
      // Last member is owner => delete the group
      await Group.findByIdAndDelete(groupId);
      await GroupMessage.deleteMany({ group: groupId });
      return res.status(200).json({
        success: true,
        message: 'Group deleted as the owner left',
      });
    }
  }

  group.members = group.members.filter((id) => id !== targetUserId);
  group.admins = group.admins.filter((id) => id !== targetUserId);
  await group.save();

  res.status(200).json({
    success: true,
    message: isSelfLeaving ? 'You left the group' : 'Member removed successfully',
  });
});

/**
 * GET /api/groups/:id/messages?cursor&limit
 * Group chat history (Members only)
 */
export const getGroupMessages = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const group = await Group.findById(req.params.id).select('members').lean();

  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  if (!(group.members || []).includes(currentUserId)) {
    throw ApiError.forbidden('You must be a member of this group to view messages');
  }

  const { limit, cursor } = parseCursorPagination(req.query, 20, 50);

  const query = { group: req.params.id };
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const messages = await GroupMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('sender', '_id full_name username profile_picture')
    .lean();

  const result = buildCursorResult(messages, limit);
  const chronological = [...result.items].reverse();

  res.status(200).json({
    success: true,
    data: chronological,
    meta: result.meta,
  });
});

/**
 * POST /api/groups/:id/messages
 * Send message to group chat (Members only)
 */
export const sendGroupMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const groupId = req.params.id;

  const group = await Group.findById(groupId).select('members').lean();
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  if (!(group.members || []).includes(currentUserId)) {
    throw ApiError.forbidden('You must be a member of this group to send messages');
  }

  let text = req.body.text || '';
  let mediaUrl = req.body.media_url || '';

  if (req.file) {
    try {
      const uploadResult = await uploadFromBuffer(req.file.buffer, {
        folder: 'flownet/messages',
      });
      mediaUrl = uploadResult.url;
    } catch (err) {
      console.warn('[Group Message Upload] Cloudinary error:', err.message);
      throw ApiError.badRequest(`Failed to upload group message media: ${err.message}`);
    }
  }

  if (!text && !mediaUrl) {
    throw ApiError.badRequest('Message must contain text or an image');
  }

  const message = await GroupMessage.create({
    group: groupId,
    sender: currentUserId,
    text,
    media_url: mediaUrl,
  });

  const populatedMessage = await GroupMessage.findById(message._id)
    .populate('sender', '_id full_name username profile_picture')
    .lean();

  // Real-time broadcast to all members connected in the group room
  emitToGroup(groupId, 'group:message', populatedMessage);

  res.status(201).json({
    success: true,
    data: populatedMessage,
  });
});
