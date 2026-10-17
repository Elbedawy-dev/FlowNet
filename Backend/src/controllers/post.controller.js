import { z } from 'zod';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBlockedUserIds, getBlockStatus, isBlockedEitherWay } from '../utils/blockUtils.js';
import { sanitizeText } from '../utils/sanitize.js';
import { uploadFromBuffer, deleteResource, extractPublicId } from '../config/cloudinary.js';
import { parseCursorPagination, buildCursorResult } from '../utils/pagination.js';
import { createNotification } from './notification.controller.js';

export const createPostSchema = z.object({
  content: z.string().max(2000).optional(),
});

export const updatePostSchema = z.object({
  content: z.string().max(2000).optional(),
  remove_image_urls: z.union([z.array(z.string()), z.string()]).optional(),
});

export const createCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment text cannot be empty').max(500),
});

/**
 * POST /api/posts
 * Create a new post (text, image, or text_with_image)
 */
export const createPost = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const rawContent = req.body.content || '';
  const sanitizedContent = sanitizeText(rawContent);

  const imageUrls = [];

  // Handle uploaded images from multer
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const uploadPromises = req.files.slice(0, 4).map((file) =>
      uploadFromBuffer(file.buffer, { folder: 'flownet/posts' }).catch((err) => {
        console.warn('[Post Upload] Failed to upload image to Cloudinary:', err.message);
        return null;
      })
    );

    const results = await Promise.all(uploadPromises);
    for (const res of results) {
      if (res?.url) {
        imageUrls.push(res.url);
      }
    }
  } else if (Array.isArray(req.body.image_urls) && req.body.image_urls.length > 0) {
    // Also support passing image URLs directly (e.g. for seed or testing)
    imageUrls.push(...req.body.image_urls.slice(0, 4));
  }

  // Must have at least content or image
  if (!sanitizedContent && imageUrls.length === 0) {
    throw ApiError.badRequest('A post must contain either text content or at least one image', 'EMPTY_POST');
  }

  // Determine post type
  let postType = 'text';
  if (sanitizedContent && imageUrls.length > 0) {
    postType = 'text_with_image';
  } else if (imageUrls.length > 0) {
    postType = 'image';
  }

  const post = await Post.create({
    user: currentUserId,
    content: sanitizedContent,
    image_urls: imageUrls,
    post_type: postType,
    likes_count: [],
    shares_count: 0,
  });

  const populatedPost = await Post.findById(post._id)
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  res.status(201).json({
    success: true,
    data: {
      ...populatedPost,
      comments_count: 0,
    },
  });
});

/**
 * GET /api/posts/feed?scope=global|following&cursor&limit
 * Feed with global default and following filter
 */
export const getFeed = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const scope = req.query.scope || 'global';
  const { limit, cursor } = parseCursorPagination(req.query, 20, 50);

  const blockedUserIds = await getBlockedUserIds(currentUserId);
  const blockedSet = new Set(blockedUserIds);

  const currentUser = await User.findById(currentUserId).select('following connections').lean();
  const myFollowing = currentUser?.following || [];
  const myConnections = currentUser?.connections || [];
  const networkSet = new Set([currentUserId, ...myFollowing, ...myConnections]);

  const query = {};

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  if (scope === 'following') {
    // Only posts from me + users I follow + connections (excluding any blocked)
    const allowedAuthors = Array.from(networkSet).filter((id) => !blockedSet.has(id));
    query.user = { $in: allowedAuthors };
  } else {
    // Global scope: everyone not blocked, not inactive
    // Plus exclude private accounts unless current user is author or follower/connection
    const privateUsers = await User.find({
      'settings.privacy.is_private_account': true,
      _id: { $nin: Array.from(networkSet) },
    })
      .select('_id')
      .lean();

    const privateUserIds = privateUsers.map((u) => u._id);
    const excludedAuthorIds = Array.from(new Set([...blockedUserIds, ...privateUserIds]));

    query.user = { $nin: excludedAuthorIds };
  }

  // Also ensure authors are active users
  const inactiveUsers = await User.find({ is_active: false }).select('_id').lean();
  const inactiveIds = inactiveUsers.map((u) => u._id);
  if (inactiveIds.length > 0) {
    if (query.user?.$nin) {
      query.user.$nin.push(...inactiveIds);
    } else if (query.user?.$in) {
      query.user.$in = query.user.$in.filter((id) => !inactiveIds.includes(id));
    } else {
      query.user = { $nin: inactiveIds };
    }
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

  const formattedPosts = posts.map((p) => ({
    _id: p._id,
    user: p.user,
    content: p.content,
    image_urls: p.image_urls,
    post_type: p.post_type,
    likes_count: p.likes_count,
    comments_count: commentCountMap.get(String(p._id)) || 0,
    shares_count: p.shares_count || 0,
    createdAt: p.createdAt,
  }));

  const result = buildCursorResult(formattedPosts, limit);

  res.status(200).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
});

/**
 * GET /api/posts/:id
 * Get single post details
 */
export const getPostById = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const post = await Post.findById(req.params.id)
    .populate('user', '_id full_name username profile_picture is_verified settings')
    .lean();

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const postOwnerId = post.user._id;

  if (await isBlockedEitherWay(currentUserId, postOwnerId)) {
    throw ApiError.blockedByUser('Cannot view post due to block restrictions');
  }

  // Check private account
  if (
    postOwnerId !== currentUserId &&
    post.user.settings?.privacy?.is_private_account
  ) {
    const owner = await User.findById(postOwnerId).select('followers connections').lean();
    const isFollower = (owner?.followers || []).includes(currentUserId);
    const isConnection = (owner?.connections || []).includes(currentUserId);
    if (!isFollower && !isConnection) {
      throw ApiError.forbidden('This account is private', 'PRIVATE_ACCOUNT');
    }
  }

  const commentsCount = await Comment.countDocuments({ post: post._id });

  const { settings, ...cleanUser } = post.user;

  res.status(200).json({
    success: true,
    data: {
      _id: post._id,
      user: cleanUser,
      content: post.content,
      image_urls: post.image_urls,
      post_type: post.post_type,
      likes_count: post.likes_count,
      comments_count: commentsCount,
      shares_count: post.shares_count || 0,
      createdAt: post.createdAt,
    },
  });
});

/**
 * PUT /api/posts/:id
 * Update post (Owner only)
 */
export const updatePost = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  if (post.user.toString() !== currentUserId) {
    throw ApiError.forbidden('You can only edit your own posts');
  }

  // Handle image removals
  let removeUrls = req.body.remove_image_urls;
  if (typeof removeUrls === 'string') {
    try {
      removeUrls = JSON.parse(removeUrls);
    } catch {
      removeUrls = [removeUrls];
    }
  }
  const removeSet = new Set(Array.isArray(removeUrls) ? removeUrls : []);

  const remainingImages = (post.image_urls || []).filter((url) => {
    if (removeSet.has(url)) {
      const publicId = extractPublicId(url);
      if (publicId) deleteResource(publicId, 'image').catch(() => {});
      return false;
    }
    return true;
  });

  // Handle newly uploaded images (max 4 total across remaining + new)
  const newImageUrls = [];
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const availableSlots = Math.max(0, 4 - remainingImages.length);
    const filesToUpload = req.files.slice(0, availableSlots);

    const uploadPromises = filesToUpload.map((file) =>
      uploadFromBuffer(file.buffer, { folder: 'flownet/posts' }).catch((err) => {
        console.warn('[Post Update Upload] Failed to upload image to Cloudinary:', err.message);
        return null;
      })
    );

    const results = await Promise.all(uploadPromises);
    for (const r of results) {
      if (r?.url) {
        newImageUrls.push(r.url);
      }
    }
  }

  const finalImageUrls = [...remainingImages, ...newImageUrls];

  // Sanitize content
  const rawContent = req.body.content !== undefined ? req.body.content : post.content;
  const sanitizedContent = sanitizeText(rawContent);

  if (!sanitizedContent && finalImageUrls.length === 0) {
    throw ApiError.badRequest('A post must contain text content or at least one image', 'EMPTY_POST');
  }

  let postType = 'text';
  if (sanitizedContent && finalImageUrls.length > 0) {
    postType = 'text_with_image';
  } else if (finalImageUrls.length > 0) {
    postType = 'image';
  }

  post.content = sanitizedContent;
  post.image_urls = finalImageUrls;
  post.post_type = postType;
  post.edited = true;
  await post.save();

  const populatedPost = await Post.findById(post._id)
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  const commentsCount = await Comment.countDocuments({ post: post._id });

  res.status(200).json({
    success: true,
    data: {
      ...populatedPost,
      comments_count: commentsCount,
    },
  });
});

/**
 * DELETE /api/posts/:id
 * Delete post (Owner only) with cascade
 */
export const deletePost = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  if (post.user.toString() !== currentUserId) {
    throw ApiError.forbidden('You can only delete your own posts');
  }

  // 1. Delete all comments on this post
  await Comment.deleteMany({ post: post._id });

  // 2. Delete all notifications referencing this post
  await Notification.deleteMany({ post: post._id });

  // 3. Delete all Cloudinary assets
  if (Array.isArray(post.image_urls) && post.image_urls.length > 0) {
    for (const url of post.image_urls) {
      const publicId = extractPublicId(url);
      if (publicId) await deleteResource(publicId, 'image');
    }
  }

  // 4. Delete the post document
  await Post.findByIdAndDelete(post._id);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully',
  });
});

/**
 * POST /api/posts/:id/like
 * Toggle like on a post and notify owner
 */
export const toggleLike = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const postOwnerId = post.user.toString();

  if (await isBlockedEitherWay(currentUserId, postOwnerId)) {
    throw ApiError.blockedByUser('Cannot like post due to block restrictions');
  }

  const isLiked = post.likes_count.includes(currentUserId);

  let updatedPost;
  if (isLiked) {
    updatedPost = await Post.findByIdAndUpdate(
      post._id,
      { $pull: { likes_count: currentUserId } },
      { new: true }
    ).select('likes_count');
  } else {
    updatedPost = await Post.findByIdAndUpdate(
      post._id,
      { $addToSet: { likes_count: currentUserId } },
      { new: true }
    ).select('likes_count');

    // Notify post owner on like (not on unlike, not if self)
    if (postOwnerId !== currentUserId) {
      await createNotification({
        user: postOwnerId,
        actor: currentUserId,
        type: 'like',
        post: post._id,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      likes_count: updatedPost.likes_count,
      is_liked: !isLiked,
    },
  });
});

/**
 * POST /api/posts/:id/share
 * Share post and increment shares_count
 */
export const sharePost = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  if (await isBlockedEitherWay(currentUserId, post.user.toString())) {
    throw ApiError.blockedByUser('Cannot share post due to block restrictions');
  }

  const updatedPost = await Post.findByIdAndUpdate(
    post._id,
    { $inc: { shares_count: 1 } },
    { new: true }
  ).select('shares_count');

  res.status(200).json({
    success: true,
    data: {
      shares_count: updatedPost.shares_count,
      post_url: `/post/${post._id}`,
    },
  });
});

/**
 * GET /api/posts/:id/comments
 * Get comments for a post in chronological order
 */
export const getPostComments = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  if (await isBlockedEitherWay(currentUserId, post.user.toString())) {
    throw ApiError.blockedByUser('Cannot view comments due to block restrictions');
  }

  const blockedUserIds = await getBlockedUserIds(currentUserId);

  const comments = await Comment.find({
    post: post._id,
    user: { $nin: blockedUserIds },
  })
    .sort({ createdAt: 1 })
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  res.status(200).json({
    success: true,
    data: comments,
  });
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post and notify post owner
 */
export const addComment = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const rawText = req.body.text || '';
  const sanitized = sanitizeText(rawText);

  if (!sanitized) {
    throw ApiError.badRequest('Comment cannot be empty', 'EMPTY_COMMENT');
  }

  if (sanitized.length > 500) {
    throw ApiError.badRequest('Comment cannot exceed 500 characters', 'COMMENT_TOO_LONG');
  }

  const post = await Post.findById(req.params.id);
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const postOwnerId = post.user.toString();

  if (await isBlockedEitherWay(currentUserId, postOwnerId)) {
    throw ApiError.blockedByUser('Cannot comment on post due to block restrictions');
  }

  const comment = await Comment.create({
    post: post._id,
    user: currentUserId,
    text: sanitized,
  });

  const populatedComment = await Comment.findById(comment._id)
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  // Notify post owner
  if (postOwnerId !== currentUserId) {
    await createNotification({
      user: postOwnerId,
      actor: currentUserId,
      type: 'comment',
      post: post._id,
      comment_text: sanitized,
    });
  }

  res.status(201).json({
    success: true,
    data: populatedComment,
  });
});

/**
 * DELETE /api/posts/:id/comments/:commentId
 * Delete a comment (Author of comment OR Post owner)
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const { id: postId, commentId } = req.params;

  const [post, comment] = await Promise.all([
    Post.findById(postId).select('user'),
    Comment.findById(commentId),
  ]);

  if (!comment) {
    throw ApiError.notFound('Comment not found');
  }

  // Author of comment OR post owner can delete
  const isCommentAuthor = comment.user === currentUserId;
  const isPostOwner = post && post.user.toString() === currentUserId;

  if (!isCommentAuthor && !isPostOwner) {
    throw ApiError.forbidden('You do not have permission to delete this comment');
  }

  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully',
  });
});
