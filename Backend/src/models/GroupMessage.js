import mongoose from 'mongoose';

const groupMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    sender: {
      type: String,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    media_url: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for group chat history
groupMessageSchema.index({ group: 1, createdAt: -1 });

export const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);
