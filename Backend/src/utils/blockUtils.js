import { User } from '../models/User.js';

/**
 * Returns a unique array of user IDs who are in a block relationship with `userId` (in either direction).
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export const getBlockedUserIds = async (userId) => {
  if (!userId) return [];

  const currentUser = await User.findById(userId).select('blocked_users').lean();
  const myBlocked = (currentUser?.blocked_users || []).map(String);

  // Users who have blocked this user
  const usersBlockingMe = await User.find({ blocked_users: userId }).select('_id').lean();
  const blockedByThem = usersBlockingMe.map((u) => String(u._id));

  return Array.from(new Set([...myBlocked, ...blockedByThem]));
};

/**
 * Check bidirectional block status between two users
 * @param {string} currentUserId
 * @param {string} targetUserId
 * @returns {Promise<{ blocked_by_me: boolean, blocked_by_them: boolean, is_blocked: boolean }>}
 */
export const getBlockStatus = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { blocked_by_me: false, blocked_by_them: false, is_blocked: false };
  }

  const [currentUser, targetUser] = await Promise.all([
    User.findById(currentUserId).select('blocked_users').lean(),
    User.findById(targetUserId).select('blocked_users').lean(),
  ]);

  const blocked_by_me = (currentUser?.blocked_users || []).includes(targetUserId);
  const blocked_by_them = (targetUser?.blocked_users || []).includes(currentUserId);

  return {
    blocked_by_me,
    blocked_by_them,
    is_blocked: blocked_by_me || blocked_by_them,
  };
};

/**
 * Quick check if either user blocked the other
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<boolean>}
 */
export const isBlockedEitherWay = async (userA, userB) => {
  const { is_blocked } = await getBlockStatus(userA, userB);
  return is_blocked;
};
