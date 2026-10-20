import { Group } from '../models/Group.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAblyClient } from '../realtime/index.js';

/**
 * GET /api/realtime/token
 * Returns an Ably TokenRequest signed with ABLY_API_KEY for the authenticated user.
 * Capability is strictly subscribe-only for:
 * - user:{userId}
 * - feed
 * - post:*
 * - group:{groupId} for each group the user is a member of
 */
export const getRealtimeToken = asyncHandler(async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const ably = getAblyClient();
  if (!ably) {
    throw ApiError.internal('Realtime service is not configured');
  }

  // Subscribe-only capability set
  const capability = {
    [`user:${userId}`]: ['subscribe'],
    feed: ['subscribe'],
    'post:*': ['subscribe'],
  };

  // Find all groups where the user is a member, admin, or owner
  const userGroups = await Group.find({
    $or: [{ members: userId }, { owner: userId }, { admins: userId }],
  })
    .select('_id')
    .lean();

  for (const g of userGroups) {
    capability[`group:${g._id}`] = ['subscribe'];
  }

  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: userId,
    ttl: 3600000,
    capability,
  });

  res.status(200).json({
    success: true,
    data: tokenRequest,
    ...tokenRequest,
  });
});
