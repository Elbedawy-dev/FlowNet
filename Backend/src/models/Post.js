import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    image_urls: {
      type: [String],
      default: [],
    },
    post_type: {
      type: String,
      enum: ['text', 'image', 'text_with_image'],
      required: true,
    },
    likes_count: {
      type: [String], // Array of user IDs who liked the post
      default: [],
    },
    shares_count: {
      type: Number,
      default: 0,
    },
    edited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for feed and user profile post queries
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

export const Post = mongoose.model('Post', postSchema);
