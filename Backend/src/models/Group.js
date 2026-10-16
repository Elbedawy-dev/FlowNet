import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    icon: {
      type: String,
      enum: ['users', 'rocket', 'globe', 'sparkles', 'star'],
      default: 'users',
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    owner: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    admins: {
      type: [String],
      default: [],
    },
    members: {
      type: [String],
      default: [],
      index: true,
    },
    pending_requests: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Group = mongoose.model('Group', groupSchema);
