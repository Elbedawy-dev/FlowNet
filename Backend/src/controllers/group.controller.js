import { z } from 'zod';
import { Group, GROUP_ICONS } from '../models/Group.js';
import { GroupMessage } from '../models/GroupMessage.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadFromBuffer } from '../config/cloudinary.js';
import { parseCursorPagination, buildCursorResult } from '../utils/pagination.js';
import { emitToGroup, emitToUser } from '../sockets/index.js';
import { createNotification } from './notification.controller.js';
import { publishToGroup, publishToUser } from '../realtime/index.js';

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Group name must be at least 3 characters')
    .max(40, 'Group name cannot exceed 40 characters'),
  icon: z.enum(GROUP_ICONS).default('users'),
  description: z
    .string()
    .trim()
    .max(200, 'Description cannot exceed 200 characters')
    .optional()
    .default(''),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Group name must be at least 3 characters')
    .max(40, 'Group name cannot exceed 40 characters')
    .optional(),
  icon: z.enum(GROUP_ICONS).optional(),
  description: z
    .string()
    .trim()
    .max(200, 'Description cannot exceed 200 characters')
    .optional(),
});

function sanitizeText(str) {
  if (!str) return '';
  // Remove non-printable control characters
  return str.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * POST /api/groups
 * Create group (open to all authenticated users)
 */
export const createGroup = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { name, icon, description } = req.body;

  const cleanName = sanitizeText(name);
  const cleanDesc = sanitizeText(description);

  if (cleanName.length < 3 || cleanName.length > 40) {
    throw ApiError.badRequest('Group name must be between 3 and 40 characters');
  }

  // 1. Anti-spam: max 5 groups owned per user
  const ownedCount = await Group.countDocuments({ owner: currentUserId });
  if (ownedCount >= 5) {
    throw ApiError.badRequest('You have reached the maximum limit of 5 owned groups');
  }

  // 2. Anti-spam: reject duplicate group names by the same owner (case-insensitive)
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = await Group.findOne({
    owner: currentUserId,
    name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  });
  if (duplicate) {
    throw ApiError.conflict('You already own a group with this name');
  }

  // 3. Create Group: owner is automatically admin and member
  const group = await Group.create({
    name: cleanName,
    icon: icon || 'users',
    description: cleanDesc,
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
 * Groups where current user is NOT a member
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
    is_owner: String(g.owner?._id || g.owner) === String(currentUserId),
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
 * Groups owned by current user
 */
export const getMyGroups = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;

  const groups = await Group.find({ owner: currentUserId })
    .sort({ createdAt: -1 })
    .lean();

  const formatted = groups.map((g) => ({
    ...g,
    members_count: (g.members || []).length,
    is_owner: true,
    is_admin: true,
  }));

  res.status(200).json({
    success: true,
    data: formatted,
  });
});

/**
 * GET /api/groups/:id
 * Get single group details with members list
 */
export const getGroupById = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const group = await Group.findById(req.params.id)
    .populate('owner', '_id full_name username profile_picture bio')
    .lean();

  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  // Populate members
  const memberUsers = await User.find({ _id: { $in: group.members || [] } })
    .select('_id full_name username profile_picture bio')
    .lean();

  const isMember = (group.members || []).includes(currentUserId);
  const isAdmin = (group.admins || []).includes(currentUserId);
  const isOwner = String(group.owner?._id || group.owner) === String(currentUserId);
  const hasPending = (group.pending_requests || []).includes(currentUserId);

  res.status(200).json({
    success: true,
    data: {
      ...group,
      members_list: memberUsers,
      members_count: (group.members || []).length,
      is_member: isMember,
      is_admin: isAdmin,
      is_owner: isOwner,
      has_pending_request: hasPending,
    },
  });
});

/**
 * PUT /api/groups/:id
 * Edit group name, description, icon (Owner or Admin only)
 */
export const updateGroup = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const groupId = req.params.id;
  const { name, description, icon } = req.body;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  const isOwnerOrAdmin = group.owner === currentUserId || group.admins.includes(currentUserId);
  if (!isOwnerOrAdmin) {
    throw ApiError.forbidden('Only group owners or admins can edit group details');
  }

  if (name !== undefined) {
    const cleanName = sanitizeText(name);
    if (cleanName.length < 3 || cleanName.length > 40) {
      throw ApiError.badRequest('Group name must be between 3 and 40 characters');
    }

    // Check duplicate name by same owner if changed
    if (cleanName.toLowerCase() !== group.name.toLowerCase()) {
      const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const duplicate = await Group.findOne({
        _id: { $ne: group._id },
        owner: group.owner,
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      });
      if (duplicate) {
        throw ApiError.conflict('A group with this name already exists for this owner');
      }
    }
    group.name = cleanName;
  }

  if (description !== undefined) {
    group.description = sanitizeText(description);
  }

  if (icon !== undefined) {
    if (!GROUP_ICONS.includes(icon)) {
      throw ApiError.badRequest(`Invalid icon. Allowed icons: ${GROUP_ICONS.join(', ')}`);
    }
    group.icon = icon;
  }

  await group.save();

  const updatedPayload = {
    _id: group._id,
    groupId: group._id,
    name: group.name,
    icon: group.icon,
    description: group.description,
  };

  // Broadcast group update
  emitToGroup(groupId, 'group:updated', updatedPayload);
  await publishToGroup(groupId, 'group:updated', updatedPayload);

  res.status(200).json({
    success: true,
    data: group,
  });
});

/**
 * DELETE /api/groups/:id
 * Delete group (Owner only) - cascades messages and notifications
 */
export const deleteGroup = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const groupId = req.params.id;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  if (group.owner !== currentUserId) {
    throw ApiError.forbidden('Only the group owner can delete the group');
  }

  // 1. Delete all messages for this group
  await GroupMessage.deleteMany({ group: groupId });

  // 2. Delete related notifications
  await Notification.deleteMany({
    $or: [
      { group: groupId },
      { type: { $in: ['group_join_request', 'group_request_accepted'] } },
    ],
  });

  // 3. Delete the group document
  await Group.findByIdAndDelete(groupId);

  // 4. Real-time emit to group room
  emitToGroup(groupId, 'group:deleted', { groupId });
  await publishToGroup(groupId, 'group:deleted', { groupId });

  res.status(200).json({
    success: true,
    message: 'Group deleted successfully along with messages and notifications',
  });
});

/**
 * POST /api/groups/:id/join-request
 * Submit request to join group
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

  // Create notifications for owner and admins
  const notifyRecipients = Array.from(new Set([group.owner, ...(group.admins || [])])).filter(
    (id) => id !== currentUserId
  );

  for (const recipientId of notifyRecipients) {
    await createNotification({
      user: recipientId,
      actor: currentUserId,
      type: 'group_join_request',
      group: group._id,
    });

    const reqPayload = {
      groupId: group._id,
      groupName: group.name,
      userId: currentUserId,
    };
    await emitToUser(recipientId, 'group:request', reqPayload);
    await publishToUser(recipientId, 'group:request', reqPayload);
  }

  res.status(200).json({
    success: true,
    message: 'Join request submitted',
  });
});

/**
 * DELETE /api/groups/:id/join-request
 * Cancel own pending join request
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
    group: group._id,
  });

  const acceptPayload = {
    groupId: group._id,
    groupName: group.name,
  };
  await emitToUser(targetUserId, 'group:request_accepted', acceptPayload);
  await publishToUser(targetUserId, 'group:request_accepted', acceptPayload);

  // Notify group chat room of new member
  const memberJoinedPayload = {
    groupId: group._id,
    userId: targetUserId,
    membersCount: group.members.length,
  };
  emitToGroup(groupId, 'group:member_joined', memberJoinedPayload);
  await publishToGroup(groupId, 'group:member_joined', memberJoinedPayload);

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
 * POST /api/groups/:id/leave
 * Member leaves group (Non-owner only)
 */
export const leaveGroup = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const groupId = req.params.id;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  if (!group.members.includes(currentUserId)) {
    throw ApiError.badRequest('You are not a member of this group');
  }

  if (group.owner === currentUserId) {
    throw ApiError.badRequest('Group owner cannot leave the group. You can delete the group instead.');
  }

  group.members = group.members.filter((id) => id !== currentUserId);
  group.admins = group.admins.filter((id) => id !== currentUserId);
  await group.save();

  const memberLeftPayload = {
    groupId: group._id,
    userId: currentUserId,
    membersCount: group.members.length,
  };
  emitToGroup(groupId, 'group:member_left', memberLeftPayload);
  await publishToGroup(groupId, 'group:member_left', memberLeftPayload);

  res.status(200).json({
    success: true,
    message: 'You have left the group',
  });
});

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove member (Owner or Admin only)
 */
export const removeMember = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { id: groupId, userId: targetUserId } = req.params;

  const group = await Group.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Group not found');
  }

  // Self leaving
  if (targetUserId === currentUserId) {
    if (group.owner === currentUserId) {
      throw ApiError.badRequest('Owner cannot leave. Use delete group instead.');
    }
    group.members = group.members.filter((id) => id !== currentUserId);
    group.admins = group.admins.filter((id) => id !== currentUserId);
    await group.save();

    const selfLeftPayload = {
      groupId: group._id,
      userId: currentUserId,
      membersCount: group.members.length,
    };
    emitToGroup(groupId, 'group:member_left', selfLeftPayload);
    await publishToGroup(groupId, 'group:member_left', selfLeftPayload);

    return res.status(200).json({
      success: true,
      message: 'You have left the group',
    });
  }

  const isOwner = group.owner === currentUserId;
  const isAdmin = group.admins.includes(currentUserId);

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Only group owners or admins can remove members');
  }

  // Admins cannot remove the owner
  if (group.owner === targetUserId) {
    throw ApiError.forbidden('Cannot remove the group owner');
  }

  // Admins cannot remove other admins (only owner can)
  if (group.admins.includes(targetUserId) && !isOwner) {
    throw ApiError.forbidden('Only the owner can remove group admins');
  }

  group.members = group.members.filter((id) => id !== targetUserId);
  group.admins = group.admins.filter((id) => id !== targetUserId);
  await group.save();

  const memberRemovedPayload = {
    groupId: group._id,
    userId: targetUserId,
    membersCount: group.members.length,
  };
  emitToGroup(groupId, 'group:member_removed', memberRemovedPayload);
  await publishToGroup(groupId, 'group:member_removed', memberRemovedPayload);
  await publishToUser(targetUserId, 'group:member_left', {
    groupId: group._id,
    userId: targetUserId,
  });

  res.status(200).json({
    success: true,
    message: 'Member removed successfully',
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

  let text = sanitizeText(req.body.text || '');
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

  // Broadcast to all members in the group room
  emitToGroup(groupId, 'group:message', populatedMessage);
  await publishToGroup(groupId, 'group:message', populatedMessage);

  res.status(201).json({
    success: true,
    data: populatedMessage,
  });
});
