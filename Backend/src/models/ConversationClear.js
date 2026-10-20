import mongoose from 'mongoose';

const conversationClearSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      ref: 'User',
      required: true,
    },
    with: {
      type: String,
      ref: 'User',
      required: true,
    },
    cleared_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

conversationClearSchema.index({ user: 1, with: 1 }, { unique: true });

export const ConversationClear = mongoose.model('ConversationClear', conversationClearSchema);
