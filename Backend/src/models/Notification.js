import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: String, // Recipient
      ref: 'User',
      required: true,
    },
    actor: {
      type: String, // Initiator
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'like',
        'comment',
        'follow',
        'connection_request',
        'connection_accepted',
        'message',
        'group_join_request',
        'group_request_accepted',
      ],
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    comment_text: {
      type: String,
      default: '',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for notification inbox and unread counts
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
