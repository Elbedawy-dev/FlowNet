import { z } from 'zod';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Connection } from '../models/Connection.js';
import { Comment } from '../models/Comment.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBlockedUserIds, getBlockStatus, isBlockedEitherWay } from '../utils/blockUtils.js';
import { uploadFromBuffer, deleteResource } from '../config/cloudinary.js';
import { parseCursorPagination, buildCursorResult, parsePagePagination, buildPageResult } from '../utils/pagination.js';
import { cascadeDeleteUser } from './webhook.controller.js';
import { clerkClient } from '@clerk/express';
import { createNotification } from './notification.controller.js';

// Validation Schemas
export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(100).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_.-]+$/, 'Username can only contain lowercase letters, numbers, underscores, dashes, and periods')
    .optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
});

export const updateSettingsSchema = z.object({
  privacy: z
    .object({
      is_private_account: z.boolean().optional(),
      who_can_message: z.enum(['everyone', 'connections']).optional(),
      show_location: z.boolean().optional(),
    })
    .optional(),
  appearance: z
    .object({
      theme: z.enum(['cosmic', 'midnight']).optional(),
      language: z.enum(['ar', 'en']).optional(),
    })
    .optional(),
  notifications: z
    .object({
      likes: z.boolean().optional(),
      comments: z.boolean().optional(),
      follows: z.boolean().optional(),
      messages: z.boolean().optional(),
      requests: z.boolean().optional(),
    })
    .optional(),
});

/**
 * GET /api/users/me
 * Get current user profile
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) {
    throw ApiError.notFound('User profile not found');
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * PUT /api/users/me
 * Update current user profile (supports multipart upload for profile_picture and cover_photo)
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.userId);
  if (!currentUser) {
    throw ApiError.notFound('User not found');
  }

  const { full_name, username, bio, location } = req.body;
  const updateData = {};

  if (full_name !== undefined) updateData.full_name = full_name.trim();
  if (bio !== undefined) updateData.bio = bio.trim();
  if (location !== undefined) updateData.location = location.trim();

  // If username is changing, ensure format and uniqueness
  if (username && username.toLowerCase() !== currentUser.username) {
    const cleanUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      throw ApiError.badRequest(
        'Username must be 3-30 characters and contain only lowercase letters, numbers, dashes, underscores, and dots',
        'INVALID_USERNAME'
      );
    }
    const existing = await User.findOne({ username: cleanUsername }).select('_id').lean();
    if (existing && existing._id !== req.userId) {
      throw new ApiError(409, 'Username is already taken', 'USERNAME_TAKEN');
    }
    updateData.username = cleanUsername;
  }

  // Handle uploaded profile picture
  if (req.files?.profile_picture?.[0]) {
    try {
      const uploadRes = await uploadFromBuffer(req.files.profile_picture[0].buffer, {
        folder: 'flownet/profile',
      });
      updateData.profile_picture = uploadRes.url;
    } catch (uploadErr) {
      console.warn('[Upload] Failed to upload profile picture to Cloudinary:', uploadErr.message);
    }
  }

  // Handle uploaded cover photo
  if (req.files?.cover_photo?.[0]) {
    try {
      const uploadRes = await uploadFromBuffer(req.files.cover_photo[0].buffer, {
        folder: 'flownet/cover',
      });
      updateData.cover_photo = uploadRes.url;
    } catch (uploadErr) {
      console.warn('[Upload] Failed to upload cover photo to Cloudinary:', uploadErr.message);
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).lean();

  res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

/**
 * GET /api/users/search?q=&page=&limit=
 * Search users by full_name, username, bio, location, or exact email
 */
export const searchUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { page, limit, skip } = parsePagePagination(req.query, 20, 50);
  const q = (req.query.q || '').trim();

  // Find all blocked user IDs in either direction
  const blockedUserIds = await getBlockedUserIds(currentUserId);
  const excludedIds = [currentUserId, ...blockedUserIds];

  const baseFilter = {
    _id: { $nin: excludedIds },
    is_active: true,
  };

  let queryFilter = { ...baseFilter };

  if (q) {
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    queryFilter.$or = [
      { full_name: regex },
      { username: regex },
      { bio: regex },
      { location: regex },
      { email: q.toLowerCase() }, // EXACT email match only
    ];
  }

  const [users, total] = await Promise.all([
    User.find(queryFilter)
      .select('_id full_name username profile_picture bio location is_verified followers settings')
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(queryFilter),
  ]);

  // Fetch connection statuses with current user
  const targetUserIds = users.map((u) => u._id);
  const connections = await Connection.find({
    $or: [
      { from_user_id: currentUserId, to_user_id: { $in: targetUserIds } },
      { from_user_id: { $in: targetUserIds }, to_user_id: currentUserId },
    ],
  }).lean();

  const currentUser = await User.findById(currentUserId).select('following').lean();
  const myFollowing = new Set(currentUser?.following || []);

  const formattedUsers = users.map((u) => {
    // Respect show_location privacy
    const showLocation = u.settings?.privacy?.show_location !== false;
    const isFollowing = myFollowing.has(u._id);

    // Determine connection status
    let connection_status = 'none';
    const conn = connections.find(
      (c) =>
        (c.from_user_id === currentUserId && c.to_user_id === u._id) ||
        (c.from_user_id === u._id && c.to_user_id === currentUserId)
    );

    if (conn) {
      if (conn.status === 'accepted') {
        connection_status = 'connected';
      } else if (conn.status === 'pending') {
        connection_status = conn.from_user_id === currentUserId ? 'pending_sent' : 'pending_received';
      }
    }

    return {
      _id: u._id,
      full_name: u.full_name,
      username: u.username,
      profile_picture: u.profile_picture,
      bio: u.bio,
      location: showLocation ? u.location : '',
      is_verified: u.is_verified,
      is_following: isFollowing,
      connection_status,
      followers_count: (u.followers || []).length,
    };
  });

  const result = buildPageResult(formattedUsers, total, page, limit);

  res.status(200).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
});

/**
 * GET /api/users/:id
 * Get single user profile with block rules & privacy
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.id;

  if (targetUserId === currentUserId) {
    const me = await User.findById(currentUserId).lean();
    return res.status(200).json({ success: true, data: me });
  }

  const { blocked_by_me, blocked_by_them } = await getBlockStatus(currentUserId, targetUserId);

  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  // When THEY blocked me: return only minimal profile with has_blocked_me: true
  if (blocked_by_them) {
    return res.status(200).json({
      success: true,
      data: {
        _id: targetUser._id,
        full_name: targetUser.full_name,
        username: targetUser.username,
        profile_picture: targetUser.profile_picture,
        has_blocked_me: true,
      },
    });
  }

  // When I blocked them: return profile with is_blocked_by_me: true
  const currentUser = await User.findById(currentUserId).select('following connections').lean();
  const isFollowing = (currentUser?.following || []).includes(targetUserId);
  const isConnection = (currentUser?.connections || []).includes(targetUserId);

  let connection_status = 'none';
  if (isConnection) {
    connection_status = 'connected';
  } else {
    const conn = await Connection.findOne({
      $or: [
        { from_user_id: currentUserId, to_user_id: targetUserId },
        { from_user_id: targetUserId, to_user_id: currentUserId },
      ],
      status: 'pending',
    }).lean();

    if (conn) {
      connection_status = conn.from_user_id === currentUserId ? 'pending_sent' : 'pending_received';
    }
  }

  const showLocation = targetUser.settings?.privacy?.show_location !== false;

  const profileData = {
    _id: targetUser._id,
    full_name: targetUser.full_name,
    username: targetUser.username,
    bio: targetUser.bio,
    profile_picture: targetUser.profile_picture,
    cover_photo: targetUser.cover_photo,
    location: showLocation ? targetUser.location : '',
    followers_count: (targetUser.followers || []).length,
    following_count: (targetUser.following || []).length,
    connections_count: (targetUser.connections || []).length,
    is_verified: targetUser.is_verified,
    is_private_account: targetUser.settings?.privacy?.is_private_account || false,
    is_following: isFollowing,
    connection_status,
    is_blocked_by_me: blocked_by_me,
    has_blocked_me: false,
    createdAt: targetUser.createdAt,
  };

  res.status(200).json({
    success: true,
    data: profileData,
  });
});

/**
 * GET /api/users/:id/posts?type=posts|media&cursor&limit
 * Get posts by a specific user respecting privacy and blocks
 */
export const getUserPosts = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.id;
  const type = req.query.type || 'posts';
  const { limit, cursor } = parseCursorPagination(req.query, 20, 50);

  const { blocked_by_them, is_blocked } = await getBlockStatus(currentUserId, targetUserId);

  // If they blocked me or any block exists, return empty posts
  if (blocked_by_them || is_blocked) {
    return res.status(200).json({
      success: true,
      data: [],
      meta: { next_cursor: null, has_more: false },
    });
  }

  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  // Check private account restrictions
  if (
    targetUserId !== currentUserId &&
    targetUser.settings?.privacy?.is_private_account
  ) {
    const isFollower = (targetUser.followers || []).includes(currentUserId);
    const isConnection = (targetUser.connections || []).includes(currentUserId);

    if (!isFollower && !isConnection) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: { next_cursor: null, has_more: false, is_private: true },
      });
    }
  }

  const query = { user: targetUserId };
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  if (type === 'media') {
    query.post_type = { $in: ['image', 'text_with_image'] };
    query['image_urls.0'] = { $exists: true };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  const postIds = posts.map((p) => p._id);
  const commentCounts = await Comment.aggregate([
    { $match: { post: { $in: postIds } } },
    { $group: { _id: '$post', count: { $sum: 1 } } },
  ]);
  const commentCountMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));

  const formattedPosts = posts.map((post) => ({
    _id: post._id,
    user: post.user,
    content: post.content,
    image_urls: post.image_urls,
    post_type: post.post_type,
    likes_count: post.likes_count,
    comments_count: commentCountMap.get(String(post._id)) || 0,
    shares_count: post.shares_count || 0,
    createdAt: post.createdAt,
  }));

  const result = buildCursorResult(formattedPosts, limit);

  res.status(200).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
});

/**
 * GET /api/users/me/network
 * Network lists: followers, following, pending (incoming requests), connections
 */
export const getMyNetwork = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const user = await User.findById(currentUserId).lean();
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const blockedIds = await getBlockedUserIds(currentUserId);
  const blockedSet = new Set(blockedIds);

  const cleanFollowers = (user.followers || []).filter((id) => !blockedSet.has(id));
  const cleanFollowing = (user.following || []).filter((id) => !blockedSet.has(id));
  const cleanConnections = (user.connections || []).filter((id) => !blockedSet.has(id));

  // Find INCOMING pending connection requests
  const pendingRequests = await Connection.find({
    to_user_id: currentUserId,
    status: 'pending',
    from_user_id: { $nin: blockedIds },
  })
    .sort({ createdAt: -1 })
    .lean();

  const pendingUserIds = pendingRequests.map((r) => r.from_user_id);

  // Populate users
  const allNeededUserIds = Array.from(
    new Set([...cleanFollowers, ...cleanFollowing, ...cleanConnections, ...pendingUserIds])
  );

  const users = await User.find({ _id: { $in: allNeededUserIds } })
    .select('_id full_name username profile_picture is_verified')
    .lean();

  const userMap = new Map(users.map((u) => [u._id, u]));

  const populateList = (ids) => ids.map((id) => userMap.get(id)).filter(Boolean);

  const followers = populateList(cleanFollowers);
  const following = populateList(cleanFollowing);
  const connections = populateList(cleanConnections);
  const pending = pendingRequests.map((r) => {
    const fromUser = userMap.get(r.from_user_id);
    return {
      _id: r._id,
      from_user: fromUser || { _id: r.from_user_id, full_name: 'User', username: 'user' },
      createdAt: r.createdAt,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      followers,
      following,
      pending,
      connections,
      counts: {
        followers: followers.length,
        following: following.length,
        pending: pending.length,
        connections: connections.length,
      },
    },
  });
});

/**
 * GET /api/users/me/blocked
 * Get list of users blocked by me
 */
export const getMyBlockedUsers = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('blocked_users').lean();
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const blockedUsers = await User.find({ _id: { $in: user.blocked_users || [] } })
    .select('_id full_name username profile_picture')
    .lean();

  res.status(200).json({
    success: true,
    data: blockedUsers,
  });
});

/**
 * PUT /api/users/me/settings
 * Update settings (privacy, appearance, notifications)
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const { privacy, appearance, notifications } = req.body;
  const updateData = {};

  if (privacy) {
    if (privacy.is_private_account !== undefined) {
      updateData['settings.privacy.is_private_account'] = privacy.is_private_account;
    }
    if (privacy.who_can_message !== undefined) {
      updateData['settings.privacy.who_can_message'] = privacy.who_can_message;
    }
    if (privacy.show_location !== undefined) {
      updateData['settings.privacy.show_location'] = privacy.show_location;
    }
  }

  if (appearance) {
    if (appearance.theme !== undefined) {
      updateData['settings.appearance.theme'] = appearance.theme;
    }
    if (appearance.language !== undefined) {
      updateData['settings.appearance.language'] = appearance.language;
    }
  }

  if (notifications) {
    if (notifications.likes !== undefined) {
      updateData['settings.notifications.likes'] = notifications.likes;
    }
    if (notifications.comments !== undefined) {
      updateData['settings.notifications.comments'] = notifications.comments;
    }
    if (notifications.follows !== undefined) {
      updateData['settings.notifications.follows'] = notifications.follows;
    }
    if (notifications.messages !== undefined) {
      updateData['settings.notifications.messages'] = notifications.messages;
    }
    if (notifications.requests !== undefined) {
      updateData['settings.notifications.requests'] = notifications.requests;
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.userId,
    { $set: updateData },
    { new: true }
  ).lean();

  res.status(200).json({
    success: true,
    data: updatedUser.settings,
  });
});

/**
 * PUT /api/users/me/deactivate
 * Deactivate account (hides from search/feed)
 */
export const deactivateAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { $set: { is_active: false } });

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully',
  });
});

/**
 * DELETE /api/users/me
 * Danger Zone: Full permanent deletion across all collections and Clerk
 */
export const deleteMyAccount = asyncHandler(async (req, res) => {
  const userId = req.userId;

  // 1. Cascade delete all data in MongoDB
  await cascadeDeleteUser(userId);

  // 2. Delete user in Clerk
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err) {
    console.warn(`[DeleteAccount] Failed to delete user from Clerk: ${err.message}`);
  }

  res.status(200).json({
    success: true,
    message: 'User account and all associated data permanently deleted',
  });
});

/**
 * POST /api/users/:id/follow
 * Follow user
 */
export const followUser = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.id;

  if (currentUserId === targetUserId) {
    throw ApiError.badRequest('You cannot follow yourself');
  }

  if (await isBlockedEitherWay(currentUserId, targetUserId)) {
    throw ApiError.blockedByUser('Cannot follow user due to block restrictions');
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw ApiError.notFound('Target user not found');
  }

  // Update followers and following
  await Promise.all([
    User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetUserId } }),
    User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: currentUserId } }),
  ]);

  // Create notification if target allows follow notifications
  if (targetUser.settings?.notifications?.follows !== false) {
    await createNotification({
      user: targetUserId,
      actor: currentUserId,
      type: 'follow',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Successfully followed user',
    data: { is_following: true },
  });
});

/**
 * DELETE /api/users/:id/follow
 * Unfollow user
 */
export const unfollowUser = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.id;

  await Promise.all([
    User.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } }),
    User.findByIdAndUpdate(targetUserId, { $pull: { followers: currentUserId } }),
  ]);

  res.status(200).json({
    success: true,
    message: 'Successfully unfollowed user',
    data: { is_following: false },
  });
});

/**
 * POST /api/users/:id/block
 * Block user (removes follow/connections in both directions)
 */
export const blockUser = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.id;

  if (currentUserId === targetUserId) {
    throw ApiError.badRequest('You cannot block yourself');
  }

  // 1. Remove relations in both directions
  await Promise.all([
    User.findByIdAndUpdate(currentUserId, {
      $addToSet: { blocked_users: targetUserId },
      $pull: { following: targetUserId, followers: targetUserId, connections: targetUserId },
    }),
    User.findByIdAndUpdate(targetUserId, {
      $pull: { following: currentUserId, followers: currentUserId, connections: currentUserId },
    }),
    Connection.deleteMany({
      $or: [
        { from_user_id: currentUserId, to_user_id: targetUserId },
        { from_user_id: targetUserId, to_user_id: currentUserId },
      ],
    }),
  ]);

  res.status(200).json({
    success: true,
    message: 'User blocked successfully',
  });
});

/**
 * DELETE /api/users/:id/block
 * Unblock user
 */
export const unblockUser = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.id;

  await User.findByIdAndUpdate(currentUserId, {
    $pull: { blocked_users: targetUserId },
  });

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully',
  });
});
