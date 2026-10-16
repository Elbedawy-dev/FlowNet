import { Webhook } from 'svix';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import mongoose from 'mongoose';

/**
 * Handle Clerk webhooks with Svix signature verification
 */
export const handleClerkWebhook = async (req, res, next) => {
  try {
    const webhookSecret = env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('[Webhook] CLERK_WEBHOOK_SECRET is not configured');
      return res.status(200).json({ success: true, message: 'Webhook secret not configured, skipping' });
    }

    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return next(ApiError.badRequest('Missing svix webhook headers', 'WEBHOOK_HEADER_MISSING'));
    }

    // Body can be raw Buffer or string
    const rawPayload = req.rawBody
      ? req.rawBody.toString('utf8')
      : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    const wh = new Webhook(webhookSecret);
    let event;

    try {
      event = wh.verify(rawPayload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      console.error('[Webhook] Svix verification failed:', err.message);
      return next(ApiError.badRequest('Webhook signature verification failed', 'INVALID_WEBHOOK_SIGNATURE'));
    }

    const { type, data } = event;
    console.log(`[Webhook] Processing Clerk event: ${type} for user: ${data?.id}`);

    switch (type) {
      case 'user.created': {
        const userId = data.id;
        const primaryEmail =
          data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ||
          data.email_addresses?.[0]?.email_address ||
          `user_${userId}@flownet.local`;

        const fullName =
          [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
          data.username ||
          'FlowNet User';

        let baseUsername = (data.username || primaryEmail.split('@')[0] || `user_${userId.slice(-6)}`)
          .toLowerCase()
          .replace(/[^a-z0-9_.-]/g, '_')
          .slice(0, 25);

        if (!baseUsername || baseUsername.length < 3) {
          baseUsername = `user_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Check if username is already taken
        const existingUsername = await User.findOne({ username: baseUsername }).lean();
        const finalUsername = existingUsername
          ? `${baseUsername.slice(0, 20)}_${Math.floor(1000 + Math.random() * 9000)}`
          : baseUsername;

        await User.findOneAndUpdate(
          { _id: userId },
          {
            $setOnInsert: {
              _id: userId,
              email: primaryEmail,
              full_name: fullName,
              username: finalUsername,
              profile_picture: data.image_url || '',
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
            },
          },
          { upsert: true, new: true }
        );
        break;
      }

      case 'user.updated': {
        const userId = data.id;
        const primaryEmail =
          data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ||
          data.email_addresses?.[0]?.email_address;

        const fullName =
          [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
          data.username;

        const updateFields = {};
        if (fullName) updateFields.full_name = fullName;
        if (data.image_url) updateFields.profile_picture = data.image_url;
        if (primaryEmail) updateFields.email = primaryEmail;

        await User.findByIdAndUpdate(userId, { $set: updateFields });
        break;
      }

      case 'user.deleted': {
        const userId = data.id;
        if (userId) {
          await cascadeDeleteUser(userId);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled Clerk event type: ${type}`);
    }

    res.status(200).json({ success: true, received: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Cascade delete all user data across all collections
 * @param {string} userId
 */
export const cascadeDeleteUser = async (userId) => {
  console.log(`[Cascade Delete] Starting full deletion for user ${userId}`);

  // 1. Delete user's posts, comments, stories, messages, notifications, connections
  // We use mongoose.connection.collection to avoid circular dependencies if models aren't loaded yet
  const db = mongoose.connection;

  await Promise.allSettled([
    db.collection('users').deleteOne({ _id: userId }),
    db.collection('posts').deleteMany({ user: userId }),
    db.collection('comments').deleteMany({ user: userId }),
    db.collection('stories').deleteMany({ user: userId }),
    db.collection('messages').deleteMany({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
    }),
    db.collection('notifications').deleteMany({
      $or: [{ user: userId }, { actor: userId }],
    }),
    db.collection('connections').deleteMany({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
    }),
    db.collection('groupmessages').deleteMany({ sender: userId }),
  ]);

  // 2. Remove userId from other users' arrays (followers, following, connections, blocked_users)
  await db.collection('users').updateMany(
    {},
    {
      $pull: {
        followers: userId,
        following: userId,
        connections: userId,
        blocked_users: userId,
      },
    }
  );

  // 3. Remove userId from likes_count in all posts
  await db.collection('posts').updateMany(
    {},
    {
      $pull: {
        likes_count: userId,
      },
    }
  );

  // 4. Remove from groups (members, admins, pending_requests)
  await db.collection('groups').updateMany(
    {},
    {
      $pull: {
        members: userId,
        admins: userId,
        pending_requests: userId,
      },
    }
  );

  // If user is owner of a group, either delete the group or reassign
  await db.collection('groups').deleteMany({ owner: userId });

  console.log(`[Cascade Delete] Finished full deletion for user ${userId}`);
};
