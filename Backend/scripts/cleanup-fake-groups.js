import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Group } from '../src/models/Group.js';
import { GroupMessage } from '../src/models/GroupMessage.js';
import { Notification } from '../src/models/Notification.js';

const isApply = process.argv.includes('--apply');

async function runCleanup() {
  try {
    await connectDB();
    console.log(`\n======================================================`);
    console.log(`MODE: ${isApply ? '🚨 APPLY (DELETION)' : '🔍 DRY-RUN (SAFE PREVIEW - NO CHANGES)'}`);
    console.log(`======================================================\n`);

    const seedOwnerId = env.SEED_OWNER_ID || 'user_2seed_demo_owner';
    const fakeNames = ['wer', '1', 'saad', 'web'];

    // Find candidate fake groups matching names
    const query = {
      name: { $in: fakeNames },
      $or: [
        { owner: seedOwnerId },
        { owner: 'user_2seed_demo_owner' },
        { owner: 'moaazelbedawy@gmail.com' },
        // Also catch if description matches known seed descriptions
        { description: { $regex: /#(react|vite|startup|future|global|community|design|art|vip|trends)/i } },
      ],
    };

    const candidateGroups = await Group.find(query).lean();

    if (candidateGroups.length === 0) {
      console.log('No fake/seed groups found matching candidate criteria.\n');
      await mongoose.connection.close();
      return;
    }

    console.log(`Found ${candidateGroups.length} candidate fake group(s):\n`);

    const groupDetails = [];
    for (const group of candidateGroups) {
      const messagesCount = await GroupMessage.countDocuments({ group: group._id });
      const membersCount = Array.isArray(group.members) ? group.members.length : 0;
      const pendingCount = Array.isArray(group.pending_requests) ? group.pending_requests.length : 0;

      groupDetails.push({
        id: group._id.toString(),
        name: group.name,
        icon: group.icon,
        owner: group.owner,
        description: group.description,
        membersCount,
        pendingCount,
        messagesCount,
        createdAt: group.createdAt,
      });

      console.log(`------------------------------------------------------`);
      console.log(`ID:           ${group._id}`);
      console.log(`Name:         "${group.name}"`);
      console.log(`Icon:         ${group.icon}`);
      console.log(`Owner:        ${group.owner}`);
      console.log(`Description:  ${group.description}`);
      console.log(`Members:      ${membersCount}`);
      console.log(`Pending:      ${pendingCount}`);
      console.log(`Messages:     ${messagesCount}`);
      console.log(`Created:      ${group.createdAt}`);
    }
    console.log(`------------------------------------------------------\n`);

    if (!isApply) {
      console.log(`ℹ️ DRY-RUN complete. ${candidateGroups.length} group(s) listed above would be deleted.`);
      console.log(`To delete these groups, GroupMessages, and related notifications, run with '--apply'.\n`);
      await mongoose.connection.close();
      return;
    }

    // APPLY MODE
    console.log(`🚨 Proceeding with deletion of ${candidateGroups.length} group(s)...`);
    const groupIds = candidateGroups.map((g) => g._id);

    // 1. Delete Group Messages
    const msgResult = await GroupMessage.deleteMany({ group: { $in: groupIds } });
    console.log(`Deleted ${msgResult.deletedCount} group message(s).`);

    // 2. Delete related notifications if any
    const notifResult = await Notification.deleteMany({
      $or: [
        { group: { $in: groupIds } },
        {
          type: { $in: ['group_join_request', 'group_request_accepted'] },
        },
      ],
    });
    console.log(`Deleted ${notifResult.deletedCount} related notification(s).`);

    // 3. Delete Groups
    const groupResult = await Group.deleteMany({ _id: { $in: groupIds } });
    console.log(`Deleted ${groupResult.deletedCount} group(s).`);

    console.log(`\n✅ Cleanup applied successfully!\n`);
    await mongoose.connection.close();
  } catch (err) {
    console.error('Cleanup script error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

runCleanup();
