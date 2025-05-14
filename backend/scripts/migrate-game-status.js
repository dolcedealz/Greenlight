// migrate-game-status.js
// Run this script to add the 'status' field to all existing Game documents
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
  console.error('Please create a .env file with your MongoDB connection string:');
  console.error('MONGODB_URI=mongodb://localhost:27017/greenlight');
  process.exit(1);
}

// Game Schema (simplified version of your actual schema)
const gameSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameType: {
    type: String,
    enum: ['coin', 'mines', 'crash', 'slots'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'completed'
  }
}, { timestamps: true });

async function runMigration() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Use the Game model
    const Game = mongoose.model('Game', gameSchema);

    // Count total games and games without status
    const totalGames = await Game.countDocuments();
    const gamesWithoutStatus = await Game.countDocuments({ status: { $exists: false } });

    console.log(`📊 Total games in database: ${totalGames}`);
    console.log(`🔍 Games without status field: ${gamesWithoutStatus}`);

    if (gamesWithoutStatus === 0) {
      console.log('✅ No games need migration. All games already have a status field.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Ask for confirmation
    rl.question(`Are you sure you want to update ${gamesWithoutStatus} games to have status='completed'? (yes/no): `, async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Migration cancelled.');
        await mongoose.disconnect();
        rl.close();
        process.exit(0);
      }

      console.log('Starting migration...');
      
      // Update all games without status to have status='completed'
      const result = await Game.updateMany(
        { status: { $exists: false } },
        { $set: { status: 'completed' } }
      );

      console.log(`✅ Migration completed successfully!`);
      console.log(`📝 Updated ${result.modifiedCount} games to have status='completed'`);

      // Find games that still don't have a status (should be 0)
      const remainingGamesWithoutStatus = await Game.countDocuments({ status: { $exists: false } });
      console.log(`🔍 Games without status after migration: ${remainingGamesWithoutStatus}`);

      // Final check to ensure all games have one of the allowed status values
      const gamesWithInvalidStatus = await Game.countDocuments({
        $and: [
          { status: { $exists: true } },
          { status: { $nin: ['active', 'completed'] } }
        ]
      });
      
      if (gamesWithInvalidStatus > 0) {
        console.warn(`⚠️ Warning: Found ${gamesWithInvalidStatus} games with invalid status values`);
      } else {
        console.log('✅ All games now have valid status values');
      }

      // Count active games
      const activeGames = await Game.countDocuments({ status: 'active' });
      console.log(`ℹ️ Games with status='active': ${activeGames}`);
      
      // Disconnect from MongoDB
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
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
runMigration();