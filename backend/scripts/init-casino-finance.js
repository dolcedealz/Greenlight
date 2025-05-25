// backend/scripts/init-casino-finance.js
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

async function initFinanceStats() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the finance service
    const { casinoFinanceService } = require('../src/services');
    
    console.log('🚀 Initializing casino finance statistics...');
    console.log('This will calculate all financial data from existing records.');
    
    // Ask for confirmation
    rl.question('Are you sure you want to proceed? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Operation cancelled.');
        await mongoose.disconnect();
        rl.close();
        process.exit(0);
      }

      console.log('Starting finance calculation...');
      
      try {
        // Run the full recalculation
        const financeState = await casinoFinanceService.recalculateAllFinances();
        
        console.log('\n✅ Finance statistics initialized successfully!\n');
        console.log('📊 SUMMARY:');
        console.log(`├ Total user balance: ${financeState.totalUserBalance.toFixed(2)} USDT`);
        console.log(`├ Operational balance: ${financeState.operationalBalance.toFixed(2)} USDT`);
        console.log(`├ Reserve (${financeState.reservePercentage}%): ${financeState.reserveBalance.toFixed(2)} USDT`);
        console.log(`├ Available for withdrawal: ${financeState.availableForWithdrawal.toFixed(2)} USDT`);
        console.log(`├ Total deposits: ${financeState.totalDeposits.toFixed(2)} USDT`);
        console.log(`├ Total withdrawals: ${financeState.totalWithdrawals.toFixed(2)} USDT`);
        console.log(`├ Total bets: ${financeState.totalBets.toFixed(2)} USDT`);
        console.log(`└ Total wins: ${financeState.totalWins.toFixed(2)} USDT`);
        
        if (financeState.warnings.lowReserve || financeState.warnings.highRiskRatio || financeState.warnings.negativeOperational) {
          console.log('\n⚠️ WARNINGS:');
          if (financeState.warnings.lowReserve) console.log('├ Low reserve level');
          if (financeState.warnings.highRiskRatio) console.log('├ High risk ratio');
          if (financeState.warnings.negativeOperational) console.log('└ Negative operational balance');
        }
        
        console.log('\n💡 You can now use /finance command in admin bot to view and manage finances.');
        
      } catch (error) {
        console.error('❌ Error during initialization:', error);
      }
      
      // Disconnect from MongoDB
      await mongoose.disconnect();
      console.log('\nDisconnected from MongoDB');
      rl.close();
    });

  } catch (error) {
    console.error('❌ Error:', error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('Error during disconnect:', disconnectError);
    }
    process.exit(1);
  }
}

// Run the initialization
console.log('🎰 GREENLIGHT CASINO - Finance Statistics Initialization\n');
initFinanceStats();