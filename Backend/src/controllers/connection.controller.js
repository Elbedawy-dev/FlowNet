import { Connection } from '../models/Connection.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isBlockedEitherWay } from '../utils/blockUtils.js';
import { createNotification } from './notification.controller.js';

/**
 * POST /api/connections/:userId/request
 * Send a connection request to another user
 */
export const sendConnectionRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  if (currentUserId === targetUserId) {
    throw ApiError.badRequest('You cannot send a connection request to yourself');
  }

  if (await isBlockedEitherWay(currentUserId, targetUserId)) {
    throw ApiError.blockedByUser('Cannot connect with this user due to privacy/block settings');
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw ApiError.notFound('Target user not found');
  }

  // Check existing connection document in either direction
  const existingConn = await Connection.findOne({
    $or: [
      { from_user_id: currentUserId, to_user_id: targetUserId },
      { from_user_id: targetUserId, to_user_id: currentUserId },
    ],
  });

  if (existingConn) {
    if (existingConn.status === 'accepted') {
      throw ApiError.conflict('You are already connected with this user');
    }

    if (existingConn.status === 'pending') {
      if (existingConn.from_user_id === currentUserId) {
        throw ApiError.conflict('Connection request already sent and pending');
      }

      // If the target had already sent a request to me, automatically accept!
      existingConn.status = 'accepted';
      await existingConn.save();

      await Promise.all([
        User.findByIdAndUpdate(currentUserId, { $addToSet: { connections: targetUserId } }),
        User.findByIdAndUpdate(targetUserId, { $addToSet: { connections: currentUserId } }),
      ]);

      if (targetUser.settings?.notifications?.requests !== false) {
        await createNotification({
          user: targetUserId,
          actor: currentUserId,
          type: 'connection_accepted',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Connection mutual match! Connected successfully',
        data: { status: 'accepted' },
      });
    }

    // If status was rejected, reset it to pending
    existingConn.from_user_id = currentUserId;
    existingConn.to_user_id = targetUserId;
    existingConn.status = 'pending';
    await existingConn.save();
  } else {
    await Connection.create({
      from_user_id: currentUserId,
      to_user_id: targetUserId,
      status: 'pending',
    });
  }

  // Create notification for recipient if allowed by their settings
  if (targetUser.settings?.notifications?.requests !== false) {
    await createNotification({
      user: targetUserId,
      actor: currentUserId,
      type: 'connection_request',
    });
  }

  res.status(201).json({
    success: true,
    message: 'Connection request sent successfully',
    data: { status: 'pending' },
  });
});

/**
 * POST /api/connections/:userId/accept
 * Accept an incoming pending connection request
 */
export const acceptConnectionRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  if (await isBlockedEitherWay(currentUserId, targetUserId)) {
    throw ApiError.blockedByUser('Cannot accept connection due to block settings');
  }

  const conn = await Connection.findOne({
    from_user_id: targetUserId,
    to_user_id: currentUserId,
    status: 'pending',
  });

  if (!conn) {
    throw ApiError.notFound('Pending connection request not found');
  }

  conn.status = 'accepted';
  await conn.save();

  // Add each to the other's connections array
  await Promise.all([
    User.findByIdAndUpdate(currentUserId, { $addToSet: { connections: targetUserId } }),
    User.findByIdAndUpdate(targetUserId, { $addToSet: { connections: currentUserId } }),
  ]);

  const targetUser = await User.findById(targetUserId).select('settings').lean();
  if (targetUser?.settings?.notifications?.requests !== false) {
    await createNotification({
      user: targetUserId,
      actor: currentUserId,
      type: 'connection_accepted',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Connection request accepted',
    data: { status: 'accepted' },
  });
});

/**
 * POST /api/connections/:userId/reject
 * Reject an incoming pending connection request
 */
export const rejectConnectionRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  const conn = await Connection.findOne({
    from_user_id: targetUserId,
    to_user_id: currentUserId,
    status: 'pending',
  });

  if (!conn) {
    throw ApiError.notFound('Pending connection request not found');
  }

  conn.status = 'rejected';
  await conn.save();

  res.status(200).json({
    success: true,
    message: 'Connection request rejected',
    data: { status: 'rejected' },
  });
});

/**
 * DELETE /api/connections/:userId
 * Remove an existing connection or cancel a pending request
 */
export const removeConnection = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId;

  // Remove connection doc
  await Connection.deleteMany({
    $or: [
      { from_user_id: currentUserId, to_user_id: targetUserId },
      { from_user_id: targetUserId, to_user_id: currentUserId },
    ],
  });

  // Pull from both users' connections array
  await Promise.all([
    User.findByIdAndUpdate(currentUserId, { $pull: { connections: targetUserId } }),
    User.findByIdAndUpdate(targetUserId, { $pull: { connections: currentUserId } }),
  ]);

  res.status(200).json({
    success: true,
    message: 'Connection removed successfully',
  });
});
