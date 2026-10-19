import mongoose from 'mongoose';

export const GROUP_ICONS = [
  'users',
  'rocket',
  'globe',
  'sparkles',
  'star',
  'code',
  'book',
  'heart',
];

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'Group name must be at least 3 characters'],
      maxlength: [40, 'Group name cannot exceed 40 characters'],
    },
    icon: {
      type: String,
      enum: GROUP_ICONS,
      default: 'users',
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    owner: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    admins: {
      type: [String],
      ref: 'User',
      default: [],
    },
    members: {
      type: [String],
      ref: 'User',
      default: [],
      index: true,
    },
    pending_requests: {
      type: [String],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for member count
groupSchema.virtual('members_count').get(function () {
  return Array.isArray(this.members) ? this.members.length : 0;
});

// Ensure owner is always in admins and members before saving
groupSchema.pre('save', function () {
  if (this.owner) {
    if (!this.admins.includes(this.owner)) {
      this.admins.push(this.owner);
    }
    if (!this.members.includes(this.owner)) {
      this.members.push(this.owner);
    }
  }
});

// Compound index to help query owned groups with name for duplicate prevention
groupSchema.index({ owner: 1, name: 1 });

export const Group = mongoose.model('Group', groupSchema);
