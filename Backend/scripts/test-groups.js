import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { GroupMessage } from '../src/models/GroupMessage.js';
import { Notification } from '../src/models/Notification.js';
import {
  createGroup,
  getAvailableGroups,
  getJoinedGroups,
  getMyGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  requestToJoinGroup,
  cancelJoinRequest,
  getGroupRequests,
  acceptJoinRequest,
  rejectJoinRequest,
  leaveGroup,
  removeMember,
  getGroupMessages,
  sendGroupMessage,
} from '../src/controllers/group.controller.js';
import rateLimit from 'express-rate-limit';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function mockContext({ userId, body = {}, params = {}, query = {}, file = null }) {
  const req = {
    userId,
    body,
    params,
    query,
    file,
    ip: '127.0.0.1',
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

// Wrapper to properly wait for asyncHandler controllers
function executeController(fn, ctx) {
  return new Promise((resolve) => {
    let errorCaught = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      resolve({
        status: errorCaught ? errorCaught.statusCode || 500 : ctx.getStatus(),
        data: errorCaught ? null : ctx.getData(),
        error: errorCaught,
      });
    };

    const next = (err) => {
      errorCaught = err;
      finish();
    };

    const originalJson = ctx.res.json;
    ctx.res.json = (data) => {
      originalJson(data);
      finish();
      return ctx.res;
    };

    try {
      fn(ctx.req, ctx.res, next);
    } catch (err) {
      errorCaught = err;
      finish();
    }
  });
}

async function runTests() {
  console.log('\n========================================================');
  console.log('🧪 Starting FlowNet Group Creation & Management Test Suite');
  console.log('========================================================\n');

  await connectDB();

  const userAId = 'user_test_group_owner_alice';
  const userBId = 'user_test_group_member_bob';
  const userCId = 'user_test_group_intruder_charlie';

  // Cleanup test users and test groups
  await User.deleteMany({ _id: { $in: [userAId, userBId, userCId] } });
  await Group.deleteMany({
    owner: { $in: [userAId, userBId, userCId] },
  });

  // Seed test users
  await User.create([
    {
      _id: userAId,
      email: 'alice.groups@flownet.test',
      full_name: 'Alice Group Owner',
      username: 'alice_group_owner',
      profile_picture: 'https://example.com/alice.jpg',
    },
    {
      _id: userBId,
      email: 'bob.groups@flownet.test',
      full_name: 'Bob Group Member',
      username: 'bob_group_member',
      profile_picture: 'https://example.com/bob.jpg',
    },
    {
      _id: userCId,
      email: 'charlie.groups@flownet.test',
      full_name: 'Charlie Non Member',
      username: 'charlie_non_member',
      profile_picture: 'https://example.com/charlie.jpg',
    },
  ]);

  try {
    // -----------------------------------------------------------------
    // TEST 1: Create Group Success
    // -----------------------------------------------------------------
    console.log('--- Test 1: Create Group (Success & Ownership Assignment) ---');
    const ctxCreate = mockContext({
      userId: userAId,
      body: {
        name: 'AI & Web3 Pioneers',
        description: 'A community exploring artificial intelligence and decentralized tech.',
        icon: 'rocket',
      },
    });

    const resCreate = await executeController(createGroup, ctxCreate);
    assert(resCreate.status === 201, 'Group created with HTTP 201 status');
    assert(resCreate.data?.success === true, 'Response contains success: true');
    const createdGroup = resCreate.data?.data;
    assert(createdGroup?.name === 'AI & Web3 Pioneers', 'Group name stored accurately');
    assert(createdGroup?.icon === 'rocket', 'Group icon stored accurately');
    assert(createdGroup?.owner === userAId, 'Owner set to current user');
    assert(createdGroup?.admins?.includes(userAId), 'Owner is automatically an admin');
    assert(createdGroup?.members?.includes(userAId), 'Owner is automatically a member');

    const groupId = createdGroup?._id;

    // -----------------------------------------------------------------
    // TEST 2: Duplicate Name Rejection for Same Owner
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: Duplicate Name Rejection for Same Owner ---');
    const ctxDup = mockContext({
      userId: userAId,
      body: {
        name: '  ai & web3 pioneers  ', // Case-insensitive duplicate
        description: 'Duplicate group test',
        icon: 'users',
      },
    });
    const resDup = await executeController(createGroup, ctxDup);
    assert(resDup.status === 409, 'Duplicate group name rejected with HTTP 409 Conflict');
    assert(
      resDup.error?.message?.includes('already own a group with this name'),
      'Clear duplicate rejection message returned'
    );

    // -----------------------------------------------------------------
    // TEST 3: Max 5 Groups Owned Limit
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: Anti-Spam - Max 5 Groups Owned Per User ---');
    // Create 4 more groups for Alice to reach the 5-group limit
    for (let i = 2; i <= 5; i++) {
      const ctx = mockContext({
        userId: userAId,
        body: {
          name: `Alice Community Group ${i}`,
          description: `Description for group ${i}`,
          icon: 'star',
        },
      });
      const res = await executeController(createGroup, ctx);
      assert(res.status === 201, `Group ${i}/5 created successfully`);
    }

    // Attempt to create the 6th group
    const ctx6 = mockContext({
      userId: userAId,
      body: {
        name: 'Alice Sixth Forbidden Group',
        description: 'Should be rejected due to 5 groups limit',
        icon: 'heart',
      },
    });
    const res6 = await executeController(createGroup, ctx6);
    assert(res6.status === 400, '6th group creation rejected with HTTP 400 Bad Request');
    assert(
      res6.error?.message?.includes('maximum limit of 5 owned groups'),
      'Error identifies 5 group ownership limit exceeded'
    );

    // -----------------------------------------------------------------
    // TEST 4: Rate Limiting Group Creation (3 per hour)
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: Rate Limiter Middleware (3 creates/hr) ---');
    const testLimiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 3,
      message: { success: false, message: 'Rate limit exceeded: max 3 per hour' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { keyGeneratorIpFallback: false },
      keyGenerator: (req) => req.userId || req.ip,
    });

    for (let i = 1; i <= 4; i++) {
      let nextCalled = false;
      const testReq = { userId: 'user_rate_limit_tester', ip: '127.0.0.1', headers: {} };
      let resStatus = 200;
      const testRes = {
        setHeader() {},
        getHeader() {},
        status(code) {
          resStatus = code;
          return testRes;
        },
        send() {},
        json() {},
      };
      await new Promise((resDone) => {
        testLimiter(testReq, testRes, () => {
          nextCalled = true;
          resDone();
        }).then(() => {
          if (!nextCalled) resDone();
        }).catch(resDone);
      });

      if (i <= 3) {
        assert(nextCalled === true, `Rate limit attempt ${i}/3 allowed`);
      } else {
        assert(resStatus === 429, 'Rate limit attempt 4/3 blocked with HTTP 429');
      }
    }

    // -----------------------------------------------------------------
    // TEST 5: Non-Member Forbidden to Read or Send Messages (403)
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: Non-Member Access Control (HTTP 403) ---');
    // Charlie (non-member) tries to read messages
    const ctxGetMsgC = mockContext({
      userId: userCId,
      params: { id: groupId.toString() },
    });
    const resGetMsgC = await executeController(getGroupMessages, ctxGetMsgC);
    assert(resGetMsgC.status === 403, 'Non-member cannot read group messages (HTTP 403)');

    // Charlie tries to send message
    const ctxSendMsgC = mockContext({
      userId: userCId,
      params: { id: groupId.toString() },
      body: { text: 'Intruder message' },
    });
    const resSendMsgC = await executeController(sendGroupMessage, ctxSendMsgC);
    assert(resSendMsgC.status === 403, 'Non-member cannot send group messages (HTTP 403)');

    // -----------------------------------------------------------------
    // TEST 6: Join Request -> Accept -> Chat Flow
    // -----------------------------------------------------------------
    console.log('\n--- Test 6: Join Request Flow -> Accept -> Member Can Chat ---');
    // Bob sends join request
    const ctxReqJoin = mockContext({
      userId: userBId,
      params: { id: groupId.toString() },
    });
    const resReqJoin = await executeController(requestToJoinGroup, ctxReqJoin);
    assert(resReqJoin.status === 200, 'User Bob successfully submitted join request');

    // Verify Bob is in pending_requests
    const groupAfterReq = await Group.findById(groupId).lean();
    assert(groupAfterReq.pending_requests.includes(userBId), 'Bob is stored in pending_requests');

    // Alice reviews requests
    const ctxGetReqs = mockContext({
      userId: userAId,
      params: { id: groupId.toString() },
    });
    const resGetReqs = await executeController(getGroupRequests, ctxGetReqs);
    assert(resGetReqs.status === 200, 'Owner Alice can fetch pending requests');
    const reqUsers = resGetReqs.data?.data || [];
    assert(
      reqUsers.some((u) => u._id === userBId),
      'Pending requests list contains Bob'
    );

    // Alice accepts Bob
    const ctxAccept = mockContext({
      userId: userAId,
      params: { id: groupId.toString(), userId: userBId },
    });
    const resAccept = await executeController(acceptJoinRequest, ctxAccept);
    assert(resAccept.status === 200, 'Owner Alice successfully accepted Bob');

    // Verify Bob is member and removed from pending
    const groupAfterAccept = await Group.findById(groupId).lean();
    assert(groupAfterAccept.members.includes(userBId), 'Bob is now added to group.members');
    assert(!groupAfterAccept.pending_requests.includes(userBId), 'Bob removed from pending_requests');

    // Verify notification was generated for Bob
    const notif = await Notification.findOne({
      user: userBId,
      actor: userAId,
      type: 'group_request_accepted',
    }).lean();
    assert(notif !== null, 'Real-time notification created for accepted member');

    // Bob can now post a message
    const ctxBobMsg = mockContext({
      userId: userBId,
      params: { id: groupId.toString() },
      body: { text: 'Hello everyone in AI & Web3!' },
    });
    const resBobMsg = await executeController(sendGroupMessage, ctxBobMsg);
    assert(resBobMsg.status === 201, 'New member Bob successfully posted a message');
    assert(
      resBobMsg.data?.data?.sender?.username === 'bob_group_member',
      'Message sender populated with full profile info'
    );

    // Bob can now read messages
    const ctxBobRead = mockContext({
      userId: userBId,
      params: { id: groupId.toString() },
    });
    const resBobRead = await executeController(getGroupMessages, ctxBobRead);
    assert(resBobRead.status === 200, 'New member Bob can read messages history');
    assert(
      (resBobRead.data?.data || []).length >= 1,
      'Messages array contains the posted message'
    );

    // -----------------------------------------------------------------
    // TEST 7: Non-Owner Permissions (Cannot Edit or Delete)
    // -----------------------------------------------------------------
    console.log('\n--- Test 7: Non-Owner Permission Enforcements ---');
    // Bob (member, non-owner) tries to edit group
    const ctxBobEdit = mockContext({
      userId: userBId,
      params: { id: groupId.toString() },
      body: { name: 'Bob Hijacked Group' },
    });
    const resBobEdit = await executeController(updateGroup, ctxBobEdit);
    assert(resBobEdit.status === 403, 'Non-owner/admin cannot edit group (HTTP 403)');

    // Bob tries to delete group
    const ctxBobDelete = mockContext({
      userId: userBId,
      params: { id: groupId.toString() },
    });
    const resBobDelete = await executeController(deleteGroup, ctxBobDelete);
    assert(resBobDelete.status === 403, 'Non-owner cannot delete group (HTTP 403)');

    // -----------------------------------------------------------------
    // TEST 8: Leave Group Enforcement
    // -----------------------------------------------------------------
    console.log('\n--- Test 8: Leave Group Rules ---');
    // Owner Alice tries to leave own group
    const ctxAliceLeave = mockContext({
      userId: userAId,
      params: { id: groupId.toString() },
    });
    const resAliceLeave = await executeController(leaveGroup, ctxAliceLeave);
    assert(resAliceLeave.status === 400, 'Owner cannot leave own group (HTTP 400)');

    // Member Bob leaves group
    const ctxBobLeave = mockContext({
      userId: userBId,
      params: { id: groupId.toString() },
    });
    const resBobLeave = await executeController(leaveGroup, ctxBobLeave);
    assert(resBobLeave.status === 200, 'Member Bob successfully left group (HTTP 200)');

    const groupAfterLeave = await Group.findById(groupId).lean();
    assert(!groupAfterLeave.members.includes(userBId), 'Bob is no longer in group.members');

    // -----------------------------------------------------------------
    // TEST 9: Owner Delete Group Cascades Messages and Notifications
    // -----------------------------------------------------------------
    console.log('\n--- Test 9: Cascade Delete of Messages and Notifications ---');
    // Ensure messages exist
    const messagesBefore = await GroupMessage.countDocuments({ group: groupId });
    assert(messagesBefore > 0, `Pre-deletion message count is ${messagesBefore}`);

    // Alice deletes group
    const ctxAliceDelete = mockContext({
      userId: userAId,
      params: { id: groupId.toString() },
    });
    const resAliceDelete = await executeController(deleteGroup, ctxAliceDelete);
    assert(resAliceDelete.status === 200, 'Owner successfully deleted group (HTTP 200)');

    // Verify group is removed
    const groupCheck = await Group.findById(groupId);
    assert(groupCheck === null, 'Group document removed from database');

    // Verify messages cascaded
    const messagesAfter = await GroupMessage.countDocuments({ group: groupId });
    assert(messagesAfter === 0, 'GroupMessages cascade-deleted to 0');

    // Verify notifications cascaded
    const notifsAfter = await Notification.countDocuments({ group: groupId });
    assert(notifsAfter === 0, 'Related group notifications cascade-deleted to 0');
  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    // Cleanup remaining test groups & users
    await Group.deleteMany({ owner: { $in: [userAId, userBId, userCId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId, userCId] } });

    console.log('\n========================================================');
    console.log(`📊 Test Results: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
