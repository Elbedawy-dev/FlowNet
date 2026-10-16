import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Post } from '../models/Post.js';

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('[Seed] Starting database seed...');

    const ownerId = env.SEED_OWNER_ID || 'user_2seed_demo_owner';

    // 1. Ensure seed owner user exists
    let ownerUser = await User.findById(ownerId);
    if (!ownerUser) {
      console.log(`[Seed] Creating seed owner user with ID: ${ownerId}`);
      ownerUser = await User.create({
        _id: ownerId,
        email: 'seed_owner@flownet.local',
        full_name: 'FlowNet Official Admin',
        username: 'flownet_admin',
        bio: 'Welcome to FlowNet! The next-generation social network.',
        location: 'Earth',
        profile_picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
        cover_photo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
        is_verified: true,
        is_active: true,
        followers: [],
        following: [],
        connections: [],
        blocked_users: [],
        settings: {
          privacy: {
            is_private_account: false,
            who_can_message: 'everyone',
            show_location: true,
          },
          appearance: {
            theme: 'cosmic',
            language: 'ar',
          },
          notifications: {
            likes: true,
            comments: true,
            follows: true,
            messages: true,
            requests: true,
          },
        },
      });
    }

    // 2. Clear old seeded groups if any
    await Group.deleteMany({ owner: ownerId });

    // 3. Create the 5 groups specified: names (web, saad, wer, wer, 1) with icons (users, rocket, globe, sparkles, star)
    const groupsData = [
      {
        name: 'web',
        icon: 'users',
        description: 'Web development enthusiasts and modern frontend architects #react #vite',
        owner: ownerId,
        admins: [ownerId],
        members: [ownerId],
        pending_requests: [],
      },
      {
        name: 'saad',
        icon: 'rocket',
        description: 'Tech startups, innovation, and futuristic engineering flows #startup #future',
        owner: ownerId,
        admins: [ownerId],
        members: [ownerId],
        pending_requests: [],
      },
      {
        name: 'wer',
        icon: 'globe',
        description: 'Global community connecting creators and developers worldwide #global #community',
        owner: ownerId,
        admins: [ownerId],
        members: [ownerId],
        pending_requests: [],
      },
      {
        name: 'wer',
        icon: 'sparkles',
        description: 'Creative design, sleek UI/UX, and cosmic aesthetics #design #art',
        owner: ownerId,
        admins: [ownerId],
        members: [ownerId],
        pending_requests: [],
      },
      {
        name: '1',
        icon: 'star',
        description: 'VIP star hub and trending discussions on FlowNet #vip #trends',
        owner: ownerId,
        admins: [ownerId],
        members: [ownerId],
        pending_requests: [],
      },
    ];

    const createdGroups = await Group.insertMany(groupsData);
    console.log(`[Seed] Created ${createdGroups.length} groups successfully.`);

    // 4. Create sample posts for the feed
    await Post.deleteMany({ user: ownerId });

    const postsData = [
      {
        user: ownerId,
        content: 'مرحباً بكم في شبكة FlowNet! ✨ استمتعوا بتجربة تواصل اجتماعي حديثة وفائقة السرعة. #flownet #welcome',
        image_urls: [
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        ],
        post_type: 'text_with_image',
        likes_count: [ownerId],
        shares_count: 5,
      },
      {
        user: ownerId,
        content: 'Building the future of social networks with Node.js, Express, Socket.io, and Clerk! 🚀 #nodejs #fullstack #dev',
        image_urls: [
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
        ],
        post_type: 'text_with_image',
        likes_count: [],
        shares_count: 12,
      },
      {
        user: ownerId,
        content: 'القصص والرسائل الفورية أصبحت متاحة الآن مع دعم كامل للصور والفيديو! جرّب إنشاء قصتك اليوم. 🌟 #stories #chat',
        image_urls: [],
        post_type: 'text',
        likes_count: [],
        shares_count: 2,
      },
    ];

    const createdPosts = await Post.insertMany(postsData);
    console.log(`[Seed] Created ${createdPosts.length} sample posts.`);

    console.log('[Seed] Seeding completed successfully! 🎉');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
