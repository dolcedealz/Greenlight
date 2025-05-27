// backend/scripts/migrate-referral-system.js
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Create readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

async function runMigration() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Use the User model
    const User = require('../src/models/user.model');
    
    // Count users
    const totalUsers = await User.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}`);
    
    // Ask for confirmation
    rl.question(`Are you sure you want to update ${totalUsers} users with referral system fields? (yes/no): `, async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Migration cancelled.');
        await mongoose.disconnect();
        rl.close();
        process.exit(0);
      }

      console.log('Starting migration...');
      
      // Update all users who don't have referralStats
      const bulkOps = [];
      
      // Find users without referralStats
      const usersWithoutStats = await User.find({ 
        'referralStats': { $exists: false } 
      });
      
      console.log(`Found ${usersWithoutStats.length} users without referralStats`);
      
      for (const user of usersWithoutStats) {
        // Count current referrals
        const totalReferrals = await User.countDocuments({ referrer: user._id });
        
        // Count active referrals
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const activeReferrals = await User.countDocuments({
          referrer: user._id,
          lastActivity: { $gte: thirtyDaysAgo },
          totalWagered: { $gt: 0 }
        });
        
        const referralsWithDeposits = await User.countDocuments({
          referrer: user._id,
          totalWagered: { $gt: 0 }
        });
        
        // Determine level based on active referrals
        let level = 'bronze';
        let commissionPercent = 5;
        
        if (activeReferrals >= 101) {
          level = 'vip';
          commissionPercent = 15;
        } else if (activeReferrals >= 51) {
          level = 'platinum';
          commissionPercent = 12;
        } else if (activeReferrals >= 21) {
          level = 'gold';
          commissionPercent = 10;
        } else if (activeReferrals >= 6) {
          level = 'silver';
          commissionPercent = 7;
        }
        
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                referralStats: {
                  totalReferrals,
                  activeReferrals,
                  referralsWithDeposits,
                  level,
                  commissionPercent,
                  totalEarned: user.referralEarnings || 0,
                  referralBalance: 0,
                  totalWithdrawn: 0,
                  levelUpdatedAt: new Date(),
                  lastPayoutAt: null
                },
                // Update old referralCount if it exists
                referralCount: totalReferrals
              }
            }
          }
        });
        
        console.log(`Prepared update for user ${user._id}: ${level} level with ${activeReferrals} active referrals`);
      }
      
      if (bulkOps.length > 0) {
        console.log(`\nExecuting bulk update for ${bulkOps.length} users...`);
        const result = await User.bulkWrite(bulkOps);
        console.log(`✅ Updated ${result.modifiedCount} users`);
      } else {
        console.log('✅ All users already have referralStats');
      }
      
      // Verify the migration
      const usersStillWithoutStats = await User.countDocuments({ 
        'referralStats': { $exists: false } 
      });
      
      console.log(`\n📊 Migration complete!`);
      console.log(`Users without referralStats: ${usersStillWithoutStats}`);
      
      // Show distribution by levels
      const levelDistribution = await User.aggregate([
        { $group: { 
          _id: '$referralStats.level', 
          count: { $sum: 1 } 
        }},
        { $sort: { _id: 1 } }
      ]);
      
      console.log('\n📈 Distribution by levels:');
      levelDistribution.forEach(level => {
        console.log(`${level._id}: ${level.count} users`);
      });
      
      // Disconnect from MongoDB
      await mongoose.disconnect();
      console.log('\nDisconnected from MongoDB');
      rl.close();
    });

  } catch (error) {
    console.error('❌ Error during migration:', error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('Error during disconnect:', disconnectError);
    }
    process.exit(1);
  }
}

// Run the migration
console.log('🎰 GREENLIGHT CASINO - Referral System Migration\n');
runMigration();