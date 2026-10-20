import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    from_user_id: {
      type: String,
      ref: 'User',
      required: true,
    },
    to_user_id: {
      type: String,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    message_type: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
    },
    media_url: {
      type: String,
      default: '',
    },
    seen: {
      type: Boolean,
      default: false,
    },
    deleted_for: [
      {
        type: String,
        ref: 'User',
      },
    ],
    is_unsent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for conversation history and unread message queries
messageSchema.index({ from_user_id: 1, to_user_id: 1, createdAt: -1 });
messageSchema.index({ to_user_id: 1, seen: 1 });
messageSchema.index({ createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
