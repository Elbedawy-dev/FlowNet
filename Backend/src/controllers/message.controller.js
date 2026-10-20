import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBlockedUserIds, getBlockStatus } from '../utils/blockUtils.js';
import { uploadFromBuffer } from '../config/cloudinary.js';
import { parseCursorPagination, buildCursorResult } from '../utils/pagination.js';
import { emitToUser } from '../sockets/index.js';
import { createNotification } from './notification.controller.js';
import { publishToUser } from '../realtime/index.js';

/**
 * GET /api/messages/recent
 * Get the latest message per conversation for the Home side panel / recent list
 */
export const getRecentMessages = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Find all messages involving current user, excluding blocked users
  const messages = await Message.find({
    $or: [
      { from_user_id: currentUserId, to_user_id: { $nin: blockedUserIds } },
      { to_user_id: currentUserId, from_user_id: { $nin: blockedUserIds } },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  // Deduplicate by conversation partner to pick the most recent message per partner
  const conversationMap = new Map();
  for (const msg of messages) {
    const partnerId = msg.from_user_id === currentUserId ? msg.to_user_id : msg.from_user_id;
    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, msg);
    }
  }

  const partnerIds = Array.from(conversationMap.keys());
  const partnerUsers = await User.find({ _id: { $in: partnerIds } })
    .select('_id full_name username profile_picture is_verified')
    .lean();

  const userMap = new Map(partnerUsers.map((u) => [u._id, u]));

  const recentList = [];
  for (const [partnerId, msg] of conversationMap.entries()) {
    const partner = userMap.get(partnerId);
    if (!partner) continue;

    const partnerProfile = {
      _id: partner._id,
      full_name: partner.full_name,
      fill_name: partner.full_name, // Supports frontend RecentMessages typo compatibility
      username: partner.username,
      profile_picture: partner.profile_picture,
      is_verified: partner.is_verified,
    };

    recentList.push({
      _id: msg._id,
      from_user_id: partnerProfile, // Formatted as other user for frontend compatibility
      other_user: partnerProfile,
      to_user_id: msg.to_user_id,
      text: msg.text,
      message_type: msg.message_type,
      media_url: msg.media_url,
      seen: msg.seen,
      createdAt: msg.createdAt,
    });
  }

  res.status(200).json({
    success: true,
    data: recentList,
  });
});

/**
 * GET /api/messages/:userId?cursor&limit
 * Get 1:1 conversation messages with another user, mark unread messages as seen
 */
export const getConversation = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;
  const { limit, cursor } = parseCursorPagination(req.query, 20, 50);

  const { blocked_by_them, blocked_by_me } = await getBlockStatus(currentUserId, targetUserId);

  const targetUser = await User.findById(targetUserId)
    .select('_id full_name username profile_picture is_verified')
    .lean();

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  // Mark all incoming messages from target user as seen
  const unreadUpdate = await Message.updateMany(
    {
      from_user_id: targetUserId,
      to_user_id: currentUserId,
      seen: false,
    },
    { $set: { seen: true } }
  );

  if (unreadUpdate.modifiedCount > 0) {
    const seenPayload = { seen_by: currentUserId, conversationWith: targetUserId };
    // Notify sender in real time that their messages have been seen
    await emitToUser(
      targetUserId,
      'message:seen',
      seenPayload,
      currentUserId
    );
    await publishToUser(targetUserId, 'message:seen', seenPayload);
  }

  const query = {
    $or: [
      { from_user_id: currentUserId, to_user_id: targetUserId },
      { from_user_id: targetUserId, to_user_id: currentUserId },
    ],
  };

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const result = buildCursorResult(messages, limit);

  // Return chronologically ordered messages in the final items array
  const chronologicalMessages = [...result.items].reverse();

  res.status(200).json({
    success: true,
    data: {
      messages: chronologicalMessages,
      other_user: targetUser,
      blocked_by_them,
      blocked_by_me,
    },
    meta: result.meta,
  });
});

/**
 * POST /api/messages/:userId
 * Send a message to another user
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  if (currentUserId === targetUserId) {
    throw ApiError.badRequest('You cannot send a message to yourself');
  }

  const { blocked_by_them, blocked_by_me } = await getBlockStatus(currentUserId, targetUserId);

  if (blocked_by_them || blocked_by_me) {
    throw ApiError.blockedByUser('Cannot send message: you have been blocked by this user or have blocked them');
  }

  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  // Privacy rule: check who_can_message setting
  if (targetUser.settings?.privacy?.who_can_message === 'connections') {
    const isConnection = (targetUser.connections || []).includes(currentUserId);
    if (!isConnection) {
      throw ApiError.messagingRestricted('This user only accepts messages from their connections');
    }
  }

  let text = req.body.text || '';
  let mediaUrl = req.body.media_url || '';
  let messageType = 'text';

  // Handle uploaded image
  if (req.file) {
    try {
      const uploadResult = await uploadFromBuffer(req.file.buffer, {
        folder: 'flownet/messages',
      });
      mediaUrl = uploadResult.url;
      messageType = 'image';
    } catch (err) {
      console.warn('[Message Upload] Failed to upload image:', err.message);
      throw ApiError.badRequest(`Failed to upload message image: ${err.message}`);
    }
  } else if (mediaUrl) {
    messageType = 'image';
  }

  if (!text && !mediaUrl) {
    throw ApiError.badRequest('Message must contain text or an image');
  }

  const message = await Message.create({
    from_user_id: currentUserId,
    to_user_id: targetUserId,
    text,
    message_type: messageType,
    media_url: mediaUrl,
    seen: false,
  });

  const messageData = message.toObject();

  // Real-time emit to recipient and sender's other sessions
  await emitToUser(targetUserId, 'message:new', messageData, currentUserId);
  await emitToUser(currentUserId, 'message:new', messageData);
  await publishToUser(targetUserId, 'message:new', messageData);
  await publishToUser(currentUserId, 'message:new', messageData);

  // Send notification to recipient (respects setting & prevents duplicates)
  await createNotification({
    user: targetUserId,
    actor: currentUserId,
    type: 'message',
  });

  res.status(201).json({
    success: true,
    data: messageData,
  });
});

/**
 * PUT /api/messages/:userId/seen
 * Mark all messages from user as seen
 */
export const markMessagesSeen = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  await Message.updateMany(
    { from_user_id: targetUserId, to_user_id: currentUserId, seen: false },
    { $set: { seen: true } }
  );

  const seenPayload = { seen_by: currentUserId, conversationWith: targetUserId };
  await emitToUser(
    targetUserId,
    'message:seen',
    seenPayload,
    currentUserId
  );
  await publishToUser(targetUserId, 'message:seen', seenPayload);
  await publishToUser(currentUserId, 'message:seen', seenPayload);

  res.status(200).json({
    success: true,
    message: 'Messages marked as seen',
  });
});
