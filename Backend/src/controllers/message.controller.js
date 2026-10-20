import { Message } from '../models/Message.js';
import { ConversationClear } from '../models/ConversationClear.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBlockedUserIds, getBlockStatus } from '../utils/blockUtils.js';
import { uploadFromBuffer, deleteResource, extractPublicId } from '../config/cloudinary.js';
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

  // Load conversation clear records for current user
  const clearRecords = await ConversationClear.find({ user: currentUserId }).lean();
  const clearedAtMap = new Map(clearRecords.map((c) => [c.with, new Date(c.cleared_at)]));

  // Find all messages involving current user, excluding blocked users and deleted_for
  const messages = await Message.find({
    $or: [
      { from_user_id: currentUserId, to_user_id: { $nin: blockedUserIds } },
      { to_user_id: currentUserId, from_user_id: { $nin: blockedUserIds } },
    ],
    deleted_for: { $ne: currentUserId },
  })
    .sort({ createdAt: -1 })
    .lean();

  // Deduplicate by conversation partner to pick the most recent message per partner
  const conversationMap = new Map();
  for (const msg of messages) {
    const partnerId = msg.from_user_id === currentUserId ? msg.to_user_id : msg.from_user_id;
    const clearedAt = clearedAtMap.get(partnerId);
    if (clearedAt && new Date(msg.createdAt) <= clearedAt) {
      continue;
    }
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
      _id: msg._id.toString(),
      from_user_id: String(msg.from_user_id),
      to_user_id: String(msg.to_user_id),
      from_user: userMap.get(msg.from_user_id) || { _id: String(msg.from_user_id) },
      to_user: userMap.get(msg.to_user_id) || { _id: String(msg.to_user_id) },
      other_user: partnerProfile,
      text: msg.is_unsent ? '' : msg.text,
      message_type: msg.message_type,
      media_url: msg.is_unsent ? '' : msg.media_url,
      is_unsent: Boolean(msg.is_unsent),
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

  const clearRecord = await ConversationClear.findOne({
    user: currentUserId,
    with: targetUserId,
  }).lean();

  const query = {
    $or: [
      { from_user_id: currentUserId, to_user_id: targetUserId },
      { from_user_id: targetUserId, to_user_id: currentUserId },
    ],
    deleted_for: { $ne: currentUserId },
  };

  if (clearRecord?.cleared_at) {
    query.createdAt = { $gt: clearRecord.cleared_at };
  }

  if (cursor) {
    query.createdAt = { ...(query.createdAt || {}), $lt: new Date(cursor) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const result = buildCursorResult(messages, limit);

  // Return chronologically ordered messages in the final items array, sanitizing unsent messages
  const chronologicalMessages = [...result.items].reverse().map((msg) => {
    if (msg.is_unsent) {
      return {
        ...msg,
        text: '',
        media_url: '',
        is_unsent: true,
      };
    }
    return msg;
  });

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

  const senderUser = await User.findById(currentUserId)
    .select('_id full_name username profile_picture is_verified')
    .lean();

  const messageData = {
    _id: message._id.toString(),
    from_user_id: String(currentUserId),
    to_user_id: String(targetUserId),
    text: message.text,
    message_type: message.message_type,
    media_url: message.media_url,
    seen: false,
    is_unsent: false,
    createdAt: message.createdAt.toISOString ? message.createdAt.toISOString() : message.createdAt,
    from_user: senderUser || { _id: String(currentUserId) },
    to_user: targetUser
      ? {
          _id: targetUser._id,
          full_name: targetUser.full_name,
          username: targetUser.username,
          profile_picture: targetUser.profile_picture,
          is_verified: targetUser.is_verified,
        }
      : { _id: String(targetUserId) },
  };

  // Real-time emit to recipient and sender's other sessions
  await emitToUser(targetUserId, 'message:new', messageData, currentUserId);
  await emitToUser(currentUserId, 'message:new', messageData);
  await publishToUser(String(targetUserId), 'message:new', messageData);
  await publishToUser(String(currentUserId), 'message:new', messageData);

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

/**
 * DELETE /api/messages/:messageId?scope=me|everyone
 * Delete message:
 * - scope=me: hide only for current user via deleted_for
 * - scope=everyone: unsend for everyone (sender only)
 */
export const deleteMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { messageId } = req.params;
  const scope = req.query.scope || req.body.scope || 'me';

  const message = await Message.findById(messageId);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  const isSender = message.from_user_id === currentUserId;
  const isRecipient = message.to_user_id === currentUserId;
  if (!isSender && !isRecipient) {
    throw ApiError.forbidden('You are not a participant in this conversation');
  }

  const partnerId = isSender ? message.to_user_id : message.from_user_id;

  if (scope === 'everyone') {
    if (!isSender) {
      throw ApiError.forbidden('Only the sender can unsend a message for everyone');
    }

    message.is_unsent = true;
    if (message.media_url) {
      const publicId = extractPublicId(message.media_url);
      if (publicId) {
        try {
          await deleteResource(publicId, 'image');
        } catch (e) {
          console.warn('[Message] Failed to delete Cloudinary media asset:', e.message);
        }
      }
    }
    message.text = '';
    message.media_url = '';
    await message.save();

    const senderPayload = {
      messageId: message._id.toString(),
      conversationWith: String(partnerId),
      everyone: true,
      scope: 'everyone',
    };
    const recipientPayload = {
      messageId: message._id.toString(),
      conversationWith: String(currentUserId),
      everyone: true,
      scope: 'everyone',
    };

    try {
      await publishToUser(String(currentUserId), 'message:deleted', senderPayload);
      await publishToUser(String(partnerId), 'message:deleted', recipientPayload);
    } catch (err) {
      console.error('[Message] Failed to publish message:deleted:', err.message);
    }
  } else {
    // scope === 'me'
    if (!message.deleted_for.includes(currentUserId)) {
      message.deleted_for.push(currentUserId);
      await message.save();
    }

    const payload = {
      messageId: message._id.toString(),
      conversationWith: String(partnerId),
      everyone: false,
      scope: 'me',
    };

    try {
      await publishToUser(String(currentUserId), 'message:deleted', payload);
    } catch (err) {
      console.error('[Message] Failed to publish message:deleted:', err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully',
  });
});

/**
 * DELETE /api/messages/conversation/:userId
 * Clear conversation history with user for current user only
 */
export const deleteConversation = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  await ConversationClear.findOneAndUpdate(
    { user: currentUserId, with: targetUserId },
    { cleared_at: new Date() },
    { upsert: true, new: true }
  );

  try {
    await publishToUser(currentUserId, 'conversation:deleted', { with: targetUserId });
  } catch (err) {
    console.error('[Message] Failed to publish conversation:deleted:', err.message);
  }

  res.status(200).json({
    success: true,
    message: 'Conversation cleared successfully',
  });
});
