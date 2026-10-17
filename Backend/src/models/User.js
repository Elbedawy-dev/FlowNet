import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String, // Clerk userId (e.g. "user_2zd...")
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      select: false, // Never leaked in responses
      lowercase: true,
      trim: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    bio: {
      type: String,
      default: 'Hey there! I am using flowNet',
      maxlength: 500,
    },
    profile_picture: {
      type: String,
      default: '',
    },
    cover_photo: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    followers: {
      type: [String],
      default: [],
    },
    following: {
      type: [String],
      default: [],
    },
    connections: {
      type: [String],
      default: [],
    },
    blocked_users: {
      type: [String],
      default: [],
    },
    is_verified: {
      type: Boolean,
      default: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    settings: {
      privacy: {
        is_private_account: {
          type: Boolean,
          default: false,
        },
        who_can_message: {
          type: String,
          enum: ['everyone', 'connections'],
          default: 'everyone',
        },
        show_location: {
          type: Boolean,
          default: true,
        },
      },
      appearance: {
        theme: {
          type: String,
          enum: ['cosmic', 'midnight'],
          default: 'cosmic',
        },
        mode: {
          type: String,
          enum: ['light', 'dark', 'system'],
          default: 'dark',
        },
        language: {
          type: String,
          enum: ['ar', 'en'],
          default: 'en',
        },
      },
      notifications: {
        likes: {
          type: Boolean,
          default: true,
        },
        comments: {
          type: Boolean,
          default: true,
        },
        follows: {
          type: Boolean,
          default: true,
        },
        messages: {
          type: Boolean,
          default: true,
        },
        requests: {
          type: Boolean,
          default: true,
        },
      },
    },
  },
  {
    timestamps: true,
    _id: false, // Tell Mongoose we supply the _id as string
  }
);

// Compound text index for search
userSchema.index(
  {
    full_name: 'text',
    username: 'text',
    bio: 'text',
    location: 'text',
  },
  {
    weights: {
      username: 10,
      full_name: 5,
      bio: 1,
      location: 1,
    },
    name: 'UserTextIndex',
  }
);

export const User = mongoose.model('User', userSchema);
