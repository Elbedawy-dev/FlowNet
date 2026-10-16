import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { Story } from '../models/Story.js';
import { Connection } from '../models/Connection.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { Group } from '../models/Group.js';
import { GroupMessage } from '../models/GroupMessage.js';
import { getBlockedUserIds, getBlockStatus, isBlockedEitherWay } from '../utils/blockUtils.js';
import { sanitizeText } from '../utils/sanitize.js';
import { createNotification } from '../controllers/notification.controller.js';
import { cascadeDeleteUser } from '../controllers/webhook.controller.js';

let passedTests = 0;
let failedTests = 0;

const assert = (condition, testName) => {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
};

const runSelfChecks = async () => {
  console.log('\n=============================================');
  console.log('🧪 Starting FlowNet Backend Self-Verification');
  console.log('=============================================\n');

  await connectDB();

  const userAId = 'user_test_alice_101';
  const userBId = 'user_test_bob_102';
  const userCId = 'user_test_charlie_103';

  // Cleanup test users first
  await Promise.all([
    cascadeDeleteUser(userAId),
    cascadeDeleteUser(userBId),
    cascadeDeleteUser(userCId),
  ]);

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: User Model, Sanitization & Defaults
    // ----------------------------------------------------
    console.log('--- Test Suite 1: User Model & Defaults ---');
    const userA = await User.create({
      _id: userAId,
      email: 'alice@flownet.test',
      full_name: 'Alice Wonderland',
      username: 'alice_wonder',
      profile_picture: 'https://example.com/alice.jpg',
      location: 'New York, USA',
      settings: {
        privacy: { is_private_account: false, who_can_message: 'everyone', show_location: true },
        appearance: { theme: 'cosmic', language: 'ar' },
        notifications: { likes: true, comments: true, follows: true, messages: true, requests: true },
      },
    });

    const userB = await User.create({
      _id: userBId,
      email: 'bob@flownet.test',
      full_name: 'Bob Builder',
      username: 'bob_builder',
      profile_picture: 'https://example.com/bob.jpg',
      location: 'London, UK',
      settings: {
        privacy: { is_private_account: false, who_can_message: 'connections', show_location: false },
        appearance: { theme: 'midnight', language: 'en' },
        notifications: { likes: true, comments: true, follows: true, messages: true, requests: true },
      },
    });

    assert(userA.bio === 'Hey there! I am using flowNet', 'User default bio is set');
    assert(userA.is_verified === true, 'User default is_verified is true');
    assert(userA.is_active === true, 'User default is_active is true');

    // Sanitization test
    const rawXSS = '<script>alert("xss")</script>Hello <b>World</b>!';
    const sanitized = sanitizeText(rawXSS);
    assert(sanitized === 'Hello World!', 'HTML tags completely stripped by sanitizeText');

    // ----------------------------------------------------
    // TEST SUITE 2: Follow, Connections & Network
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Follow & Connections ---');
    // Alice follows Bob
    await User.findByIdAndUpdate(userAId, { $addToSet: { following: userBId } });
    await User.findByIdAndUpdate(userBId, { $addToSet: { followers: userAId } });

    const updatedAlice = await User.findById(userAId).lean();
    const updatedBob = await User.findById(userBId).lean();
    assert(updatedAlice.following.includes(userBId), 'Alice following array contains Bob');
    assert(updatedBob.followers.includes(userAId), 'Bob followers array contains Alice');

    // Connection Request: Alice -> Bob
    const connRequest = await Connection.create({
      from_user_id: userAId,
      to_user_id: userBId,
      status: 'pending',
    });
    assert(connRequest.status === 'pending', 'Connection request created as pending');

    // Bob accepts connection
    connRequest.status = 'accepted';
    await connRequest.save();
    await User.findByIdAndUpdate(userAId, { $addToSet: { connections: userBId } });
    await User.findByIdAndUpdate(userBId, { $addToSet: { connections: userAId } });

    const aliceConn = await User.findById(userAId).select('connections').lean();
    const bobConn = await User.findById(userBId).select('connections').lean();
    assert(aliceConn.connections.includes(userBId) && bobConn.connections.includes(userAId), 'Both users have each other in connections array');

    // ----------------------------------------------------
    // TEST SUITE 3: Posts, Comments, Likes & Shares
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Posts & Interactions ---');
    const postA = await Post.create({
      user: userAId,
      content: 'Hello FlowNet! #firstPost',
      image_urls: ['https://example.com/photo1.jpg'],
      post_type: 'text_with_image',
      likes_count: [],
      shares_count: 0,
    });
    assert(postA.post_type === 'text_with_image', 'Post created with correct post_type');

    // Like toggle
    await Post.findByIdAndUpdate(postA._id, { $addToSet: { likes_count: userBId } });
    let likedPost = await Post.findById(postA._id).lean();
    assert(likedPost.likes_count.includes(userBId), 'Bob liked Alice post');

    await Post.findByIdAndUpdate(postA._id, { $pull: { likes_count: userBId } });
    likedPost = await Post.findById(postA._id).lean();
    assert(!likedPost.likes_count.includes(userBId), 'Bob unliked Alice post');

    // Comment
    const comment = await Comment.create({
      post: postA._id,
      user: userBId,
      text: 'Great post Alice!',
    });
    assert(comment.text === 'Great post Alice!', 'Comment created successfully');

    // Share
    await Post.findByIdAndUpdate(postA._id, { $inc: { shares_count: 1 } });
    const sharedPost = await Post.findById(postA._id).lean();
    assert(sharedPost.shares_count === 1, 'Shares count incremented');

    // ----------------------------------------------------
    // TEST SUITE 4: Stories & 24h Expiration
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Stories & TTL ---');
    const story = await Story.create({
      user: userAId,
      content: 'Alice Day Story',
      media_type: 'text',
      background_color: '#ca8a04',
      views_count: [],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    assert(story.expires_at > new Date(), 'Story has future 24h expiration timestamp');
    await Story.findByIdAndUpdate(story._id, { $addToSet: { views_count: userBId } });
    const viewedStory = await Story.findById(story._id).lean();
    assert(viewedStory.views_count.includes(userBId), 'Bob viewed Alice story once');

    // ----------------------------------------------------
    // TEST SUITE 5: Block Enforcement (Full System Check)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Block Enforcement ---');
    // Bob blocks Alice
    await User.findByIdAndUpdate(userBId, {
      $addToSet: { blocked_users: userAId },
      $pull: { following: userAId, followers: userAId, connections: userAId },
    });
    await User.findByIdAndUpdate(userAId, {
      $pull: { following: userBId, followers: userBId, connections: userBId },
    });
    await Connection.deleteMany({
      $or: [
        { from_user_id: userAId, to_user_id: userBId },
        { from_user_id: userBId, to_user_id: userAId },
      ],
    });

    const blockStatusFromAlice = await getBlockStatus(userAId, userBId);
    assert(blockStatusFromAlice.blocked_by_them === true, 'Alice recognizes Bob blocked her');
    assert(blockStatusFromAlice.blocked_by_me === false, 'Alice has not blocked Bob');

    const blockStatusFromBob = await getBlockStatus(userBId, userAId);
    assert(blockStatusFromBob.blocked_by_me === true, 'Bob recognizes he blocked Alice');
    assert(blockStatusFromBob.blocked_by_them === false, 'Alice did not block Bob');

    const isBlocked = await isBlockedEitherWay(userAId, userBId);
    assert(isBlocked === true, 'isBlockedEitherWay returns true for both');

    const blockedList = await getBlockedUserIds(userAId);
    assert(blockedList.includes(userBId), 'Bob is included in Alice bidirectional blocked list');

    // Relations removed both ways
    const aCheck = await User.findById(userAId).lean();
    const bCheck = await User.findById(userBId).lean();
    assert(!aCheck.following.includes(userBId) && !bCheck.following.includes(userAId), 'Following removed both ways on block');
    assert(!aCheck.connections.includes(userBId) && !bCheck.connections.includes(userAId), 'Connections removed both ways on block');

    // ----------------------------------------------------
    // TEST SUITE 6: Notifications & Sockets
    // ----------------------------------------------------
    console.log('\n--- Test Suite 6: Notifications ---');
    // Charlie creates a notification for Alice
    const userC = await User.create({
      _id: userCId,
      email: 'charlie@flownet.test',
      full_name: 'Charlie Brown',
      username: 'charlie_brown',
      profile_picture: 'https://example.com/charlie.jpg',
      settings: {
        privacy: { is_private_account: false, who_can_message: 'everyone', show_location: true },
        appearance: { theme: 'cosmic', language: 'en' },
        notifications: { likes: true, comments: true, follows: true, messages: true, requests: true },
      },
    });

    const notif = await createNotification({
      user: userAId,
      actor: userCId,
      type: 'follow',
    });
    assert(notif !== null, 'Follow notification created successfully');

    // Blocked user notification suppression test: Bob cannot send notification to Alice
    const blockedNotif = await createNotification({
      user: userAId,
      actor: userBId,
      type: 'like',
      post: postA._id,
    });
    assert(blockedNotif === null, 'Notification suppressed when actor is blocked');

    // ----------------------------------------------------
    // TEST SUITE 7: Cascade Deletion
    // ----------------------------------------------------
    console.log('\n--- Test Suite 7: Cascade Deletion ---');
    await cascadeDeleteUser(userCId);
    const deletedC = await User.findById(userCId);
    const leftoverNotif = await Notification.findOne({ actor: userCId });
    assert(deletedC === null, 'User C deleted by cascade');
    assert(leftoverNotif === null, 'All notifications by User C purged by cascade');

    // Cleanup remaining test accounts
    await cascadeDeleteUser(userAId);
    await cascadeDeleteUser(userBId);

    console.log('\n=============================================');
    console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('=============================================\n');

    await mongoose.connection.close();
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test run failed with error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

runSelfChecks();
