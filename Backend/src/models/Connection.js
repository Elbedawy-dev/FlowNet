import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index so a user cannot send duplicate connection requests to the same target
connectionSchema.index({ from_user_id: 1, to_user_id: 1 }, { unique: true });
connectionSchema.index({ to_user_id: 1, status: 1 });
connectionSchema.index({ from_user_id: 1, status: 1 });

export const Connection = mongoose.model('Connection', connectionSchema);
