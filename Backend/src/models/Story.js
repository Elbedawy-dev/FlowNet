import mongoose from 'mongoose';

const storySchema = new mongoose.Schema(
  {
    user: {
      type: String,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    media_url: {
      type: String,
      default: '',
    },
    media_type: {
      type: String,
      enum: ['text', 'image', 'video'],
      default: 'text',
    },
    background_color: {
      type: String,
      default: '#4f46e5',
    },
    views_count: {
      type: [String], // Array of user IDs who viewed the story
      default: [],
    },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from creation
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB TTL index for automatic 24-hour expiration
storySchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ user: 1, createdAt: -1 });

export const Story = mongoose.model('Story', storySchema);
