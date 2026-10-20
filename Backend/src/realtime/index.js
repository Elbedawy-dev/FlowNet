import Ably from 'ably';
import { env } from '../config/env.js';

let ablyRest = null;

export const getAblyClient = () => {
  if (!ablyRest) {
    const apiKey = process.env.ABLY_API_KEY || env.ABLY_API_KEY;
    if (apiKey) {
      try {
        ablyRest = new Ably.Rest({ key: apiKey });
      } catch (err) {
        console.error('[Ably] Failed to initialize Ably.Rest client:', err.message);
      }
    } else {
      console.warn('[Ably] ABLY_API_KEY not configured.');
    }
  }
  return ablyRest;
};

// Initialize on module load if key available
getAblyClient();

/**
 * Publish event to a specific user's private channel
 * Channel: user:{userId}
 */
export const publishToUser = async (userId, event, data) => {
  if (!userId) return;
  const client = getAblyClient();
  if (!client) {
    console.warn('[Ably] Cannot publishToUser: Ably client not initialized');
    return;
  }
  try {
    const channel = client.channels.get(`user:${userId}`);
    await channel.publish(event, data);
  } catch (err) {
    console.error(`[Ably] Error publishing event "${event}" to channel "user:${userId}":`, err.message);
  }
};

/**
 * Publish event to global feed channel
 * Channel: feed
 */
export const publishToFeed = async (event, data) => {
  const client = getAblyClient();
  if (!client) {
    console.warn('[Ably] Cannot publishToFeed: Ably client not initialized');
    return;
  }
  try {
    const channel = client.channels.get('feed');
    await channel.publish(event, data);
  } catch (err) {
    console.error(`[Ably] Error publishing event "${event}" to channel "feed":`, err.message);
  }
};

/**
 * Publish event to post room channel
 * Channel: post:{postId}
 */
export const publishToPost = async (postId, event, data) => {
  if (!postId) return;
  const client = getAblyClient();
  if (!client) {
    console.warn('[Ably] Cannot publishToPost: Ably client not initialized');
    return;
  }
  try {
    const channel = client.channels.get(`post:${postId}`);
    await channel.publish(event, data);
  } catch (err) {
    console.error(`[Ably] Error publishing event "${event}" to channel "post:${postId}":`, err.message);
  }
};

/**
 * Publish event to group room channel
 * Channel: group:{groupId}
 */
export const publishToGroup = async (groupId, event, data) => {
  if (!groupId) return;
  const client = getAblyClient();
  if (!client) {
    console.warn('[Ably] Cannot publishToGroup: Ably client not initialized');
    return;
  }
  try {
    const channel = client.channels.get(`group:${groupId}`);
    await channel.publish(event, data);
  } catch (err) {
    console.error(`[Ably] Error publishing event "${event}" to channel "group:${groupId}":`, err.message);
  }
};
