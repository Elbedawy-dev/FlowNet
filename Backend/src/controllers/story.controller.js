import { Story } from '../models/Story.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBlockedUserIds, isBlockedEitherWay } from '../utils/blockUtils.js';
import { uploadFromBuffer, deleteResource } from '../config/cloudinary.js';

/**
 * POST /api/stories
 * Create a new story (text, image, or video <= 60s)
 */
export const createStory = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const content = req.body.content || '';
  const backgroundColor = req.body.background_color || '#4f46e5';

  let mediaUrl = req.body.media_url || '';
  let mediaType = req.body.media_type || 'text';

  // If a file was uploaded via multer
  if (req.file) {
    const isVideo = req.file.mimetype.startsWith('video/');
    mediaType = isVideo ? 'video' : 'image';

    try {
      const uploadResult = await uploadFromBuffer(req.file.buffer, {
        folder: 'flownet/stories',
        resource_type: isVideo ? 'video' : 'image',
      });

      // Verify video duration constraint (must be <= 60 seconds)
      if (isVideo && uploadResult.duration && uploadResult.duration > 60) {
        // Destroy the uploaded video asset immediately
        await deleteResource(uploadResult.public_id, 'video');
        throw ApiError.badRequest(
          `Story video duration exceeds 60 seconds limit (${Math.round(uploadResult.duration)}s)`,
          'VIDEO_TOO_LONG'
        );
      }

      mediaUrl = uploadResult.url;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.warn('[Story Upload] Cloudinary error:', err.message);
      throw ApiError.badRequest(`Failed to upload story media: ${err.message}`);
    }
  }

  if (!content && !mediaUrl) {
    throw ApiError.badRequest('A story must include text content or media', 'EMPTY_STORY');
  }

  const story = await Story.create({
    user: currentUserId,
    content,
    media_url: mediaUrl,
    media_type: mediaType,
    background_color: backgroundColor,
    views_count: [],
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
  });

  const populatedStory = await Story.findById(story._id)
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  res.status(201).json({
    success: true,
    data: populatedStory,
  });
});

/**
 * GET /api/stories
 * Returns flat list of active stories visible to current user (owner + followers + connections minus blocked)
 */
export const getStories = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;

  const currentUser = await User.findById(currentUserId).select('following connections').lean();
  const myFollowing = currentUser?.following || [];
  const myConnections = currentUser?.connections || [];

  // Stories are visible from: me, people I follow, and my connections
  const eligibleAuthors = Array.from(new Set([currentUserId, ...myFollowing, ...myConnections]));

  const blockedUserIds = await getBlockedUserIds(currentUserId);
  const blockedSet = new Set(blockedUserIds);

  const cleanAuthors = eligibleAuthors.filter((id) => !blockedSet.has(id));

  const now = new Date();

  const stories = await Story.find({
    user: { $in: cleanAuthors },
    expires_at: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .populate('user', '_id full_name username profile_picture is_verified')
    .lean();

  res.status(200).json({
    success: true,
    data: stories,
  });
});

/**
 * POST /api/stories/:id/view
 * Record a view on a story
 */
export const viewStory = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const story = await Story.findById(req.params.id);

  if (!story || story.expires_at <= new Date()) {
    throw ApiError.notFound('Story has expired or does not exist');
  }

  if (await isBlockedEitherWay(currentUserId, story.user.toString())) {
    throw ApiError.blockedByUser('Cannot view story due to block restrictions');
  }

  const updatedStory = await Story.findByIdAndUpdate(
    story._id,
    { $addToSet: { views_count: currentUserId } },
    { new: true }
  ).select('views_count');

  res.status(200).json({
    success: true,
    data: {
      views_count: updatedStory.views_count,
    },
  });
});

/**
 * DELETE /api/stories/:id
 * Delete story (owner only)
 */
export const deleteStory = asyncHandler(async (req, res) => {
  const currentUserId = req.userId;
  const story = await Story.findById(req.params.id);

  if (!story) {
    throw ApiError.notFound('Story not found');
  }

  if (story.user.toString() !== currentUserId) {
    throw ApiError.forbidden('You can only delete your own stories');
  }

  await Story.findByIdAndDelete(story._id);

  res.status(200).json({
    success: true,
    message: 'Story deleted successfully',
  });
});
