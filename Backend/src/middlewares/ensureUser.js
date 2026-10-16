import { clerkClient } from '@clerk/express';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Generate a unique, sanitized username from Clerk username or email prefix
 */
const generateUniqueUsername = async (baseName) => {
  let cleaned = (baseName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .slice(0, 25);

  if (!cleaned || cleaned.length < 3) {
    cleaned = `user_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let candidate = cleaned;
  let attempts = 0;

  while (attempts < 10) {
    const existing = await User.findOne({ username: candidate }).select('_id').lean();
    if (!existing) {
      return candidate;
    }
    const suffix = Math.floor(100 + Math.random() * 9000);
    candidate = `${cleaned.slice(0, 20)}_${suffix}`;
    attempts++;
  }

  return `${cleaned.slice(0, 18)}_${Date.now().toString().slice(-4)}`;
};

/**
 * Ensures a User document exists in MongoDB for the authenticated Clerk user.
 * Lazily creates it from Clerk metadata if it does not exist yet.
 */
export const ensureUser = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(ApiError.unauthorized('No user ID found on request'));
    }

    let user = await User.findById(userId);

    if (user) {
      req.currentUser = user;
      return next();
    }

    // Fetch user details from Clerk
    let clerkUser = null;
    try {
      clerkUser = await clerkClient.users.getUser(userId);
    } catch (err) {
      console.warn(`[ensureUser] Failed to fetch Clerk user ${userId}:`, err.message);
    }

    const primaryEmail =
      clerkUser?.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress ||
      `user_${userId}@flownet.local`;

    const fullName =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim() ||
      clerkUser?.username ||
      'FlowNet User';

    const rawUsernameBase =
      clerkUser?.username ||
      primaryEmail.split('@')[0] ||
      `user_${userId.slice(-6)}`;

    const username = await generateUniqueUsername(rawUsernameBase);

    user = await User.create({
      _id: userId,
      email: primaryEmail,
      full_name: fullName,
      username,
      profile_picture: clerkUser?.imageUrl || '',
      cover_photo: '',
      bio: 'Hey there! I am using flowNet',
      location: '',
      followers: [],
      following: [],
      connections: [],
      blocked_users: [],
      is_verified: true,
      is_active: true,
      settings: {
        privacy: {
          is_private_account: false,
          who_can_message: 'everyone',
          show_location: true,
        },
        appearance: {
          theme: 'cosmic',
          language: 'ar',
        },
        notifications: {
          likes: true,
          comments: true,
          follows: true,
          messages: true,
          requests: true,
        },
      },
    });

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
