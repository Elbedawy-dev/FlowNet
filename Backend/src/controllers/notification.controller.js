import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBlockedUserIds, isBlockedEitherWay } from '../utils/blockUtils.js';
import { parseCursorPagination, buildCursorResult } from '../utils/pagination.js';
import { emitToUser } from '../sockets/index.js';

/**
 * Reusable helper to create a notification, check recipient settings, and emit in real-time
 */
export const createNotification = async ({
  user,
  actor,
  type,
  post = null,
  comment_text = '',
}) => {
  try {
    if (!user || !actor || user === actor) return null;

    // Check bidirectional block rules
    if (await isBlockedEitherWay(user, actor)) {
      return null;
    }

    // Check recipient's notification preferences
    const recipient = await User.findById(user).select('settings').lean();
    if (!recipient) return null;

    const notifSettings = recipient.settings?.notifications;
    if (notifSettings) {
      if (type === 'like' && notifSettings.likes === false) return null;
      if (type === 'comment' && notifSettings.comments === false) return null;
      if (type === 'follow' && notifSettings.follows === false) return null;
      if (type === 'message' && notifSettings.messages === false) return null;
      if (
        (type === 'connection_request' || type === 'connection_accepted') &&
        notifSettings.requests === false
      ) {
        return null;
      }
    }

    // For like notifications: prevent duplicate notifications within 1 hour
    if (type === 'like' && post) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existingLike = await Notification.findOne({
        user,
        actor,
        type: 'like',
        post,
        createdAt: { $gte: oneHourAgo },
      }).lean();

      if (existingLike) return null;
    }

    // For message notifications: create only if no unread message notification from same sender exists
    if (type === 'message') {
      const existingUnreadMsg = await Notification.findOne({
        user,
        actor,
        type: 'message',
        read: false,
      }).lean();

      if (existingUnreadMsg) return null;
    }

    const notification = await Notification.create({
      user,
      actor,
      type,
      post,
      comment_text,
      read: false,
    });

    const populated = await Notification.findById(notification._id)
      .populate('actor', '_id full_name username profile_picture')
      .populate('post', '_id content image_urls')
      .lean();

    // Emit in real time via Socket.io
    await emitToUser(user, 'notification:new', populated, actor);

    return populated;
  } catch (err) {
    console.warn('[Notification] Failed to create notification:', err.message);
    return null;
  }
};

/**
 * GET /api/notifications?type=all|likes|comments|media&cursor&limit
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const typeFilter = req.query.type || 'all';
  const { limit, cursor } = parseCursorPagination(req.query, 20, 50);

  const blockedUserIds = await getBlockedUserIds(currentUserId);

  const query = {
    user: currentUserId,
    actor: { $nin: blockedUserIds },
  };

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  if (typeFilter === 'likes') {
    query.type = 'like';
  } else if (typeFilter === 'comments') {
    query.type = 'comment';
  }

  let notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 5) // fetch a few extra in case media filtering filters some out
    .populate('actor', '_id full_name username profile_picture')
    .populate('post', '_id content image_urls')
    .lean();

  if (typeFilter === 'media') {
    notifications = notifications.filter(
      (n) => n.post && Array.isArray(n.post.image_urls) && n.post.image_urls.length > 0
    );
  }

  const result = buildCursorResult(notifications, limit);

  res.status(200).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
});

/**
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  const count = await Notification.countDocuments({
    user: currentUserId,
    read: false,
    actor: { $nin: blockedUserIds },
  });

  res.status(200).json({
    success: true,
    data: { unread_count: count },
  });
});

/**
 * PUT /api/notifications/read
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.userId, read: false }, { $set: { read: true } });

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
  });
});

/**
 * PUT /api/notifications/:id/read
 * Mark single notification as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { $set: { read: true } },
    { new: true }
  );

  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  res.status(200).json({
    success: true,
    data: notification,
  });
});
