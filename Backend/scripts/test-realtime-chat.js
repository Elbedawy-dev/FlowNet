import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { GroupMessage } from '../src/models/GroupMessage.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runRealtimeTest() {
  console.log('\n========================================================');
  console.log('⚡ FlowNet Real-Time Multi-User Socket Verification');
  console.log('========================================================\n');

  await connectDB();

  const userAId = 'user_rt_alice';
  const userBId = 'user_rt_bob';

  // Cleanup
  await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  await Group.deleteMany({ owner: userAId });

  // Create Users
  const [alice, bob] = await User.create([
    {
      _id: userAId,
      email: 'alice.rt@test.local',
      full_name: 'Alice Realtime',
      username: 'alice_rt',
      profile_picture: '',
    },
    {
      _id: userBId,
      email: 'bob.rt@test.local',
      full_name: 'Bob Realtime',
      username: 'bob_rt',
      profile_picture: '',
    },
  ]);

  // Alice creates group
  const group = await Group.create({
    name: 'Cosmic Realtime Hackers',
    description: 'Testing live sockets between Alice and Bob',
    icon: 'rocket',
    owner: userAId,
    admins: [userAId],
    members: [userAId],
    pending_requests: [userBId], // Bob requested
  });

  const groupId = group._id.toString();

  // Connect Alice socket
  const socketAlice = io('http://localhost:5000', {
    auth: { token: userAId },
    transports: ['websocket'],
  });

  // Connect Bob socket
  const socketBob = io('http://localhost:5000', {
    auth: { token: userBId },
    transports: ['websocket'],
  });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const check = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    socketAlice.on('connect', check);
    socketBob.on('connect', check);
  });

  assert(socketAlice.connected, 'Alice connected to Socket.io server');
  assert(socketBob.connected, 'Bob connected to Socket.io server');

  // Alice accepts Bob's request in DB
  group.pending_requests = [];
  group.members.push(userBId);
  await group.save();

  // Both join group room
  socketAlice.emit('group:join', { groupId });
  socketBob.emit('group:join', { groupId });

  await new Promise((r) => setTimeout(r, 400));

  // Listen for messages
  let aliceReceivedBobMsg = false;
  let bobReceivedAliceMsg = false;

  socketAlice.on('group:message', (msg) => {
    if (msg.text === 'Hello Alice from Bob! 👋') {
      aliceReceivedBobMsg = true;
    }
  });

  socketBob.on('group:message', (msg) => {
    if (msg.text === 'Welcome to Cosmic Hackers Bob! 🚀') {
      bobReceivedAliceMsg = true;
    }
  });

  // Simulate Alice sending message to group
  const aliceMsg = await GroupMessage.create({
    group: groupId,
    sender: userAId,
    text: 'Welcome to Cosmic Hackers Bob! 🚀',
  });
  const popAliceMsg = await GroupMessage.findById(aliceMsg._id)
    .populate('sender', '_id full_name username profile_picture')
    .lean();

  // Import getIO to broadcast
  const { emitToGroup } = await import('../src/sockets/index.js');
  emitToGroup(groupId, 'group:message', popAliceMsg);

  await new Promise((r) => setTimeout(r, 400));
  assert(bobReceivedAliceMsg, 'Bob received Alice group message in real time without reload');

  // Simulate Bob sending message to group
  const bobMsg = await GroupMessage.create({
    group: groupId,
    sender: userBId,
    text: 'Hello Alice from Bob! 👋',
  });
  const popBobMsg = await GroupMessage.findById(bobMsg._id)
    .populate('sender', '_id full_name username profile_picture')
    .lean();

  emitToGroup(groupId, 'group:message', popBobMsg);

  await new Promise((r) => setTimeout(r, 400));
  assert(aliceReceivedBobMsg, 'Alice received Bob group message in real time without reload');

  // Disconnect sockets & cleanup
  socketAlice.disconnect();
  socketBob.disconnect();

  await GroupMessage.deleteMany({ group: groupId });
  await Group.deleteMany({ _id: groupId });
  await User.deleteMany({ _id: { $in: [userAId, userBId] } });

  console.log('\n========================================================');
  console.log(`📊 Real-Time Sockets Results: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runRealtimeTest();
