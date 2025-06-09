// check_financial_integrity.js - Проверка финансовой целостности системы
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Transaction, Game, CasinoFinance } = require('./src/models');

// Подключение к базе данных
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB установлено');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

async function checkFinancialIntegrity() {
  await connectDB();
  
  try {
    console.log('\n🔍 ПРОВЕРКА ФИНАНСОВОЙ ЦЕЛОСТНОСТИ СИСТЕМЫ\n');
    
    // 1. Проверяем общую сумму балансов пользователей
    const users = await User.find({ isBlocked: false });
    const totalUserBalance = users.reduce((sum, user) => sum + (user.balance || 0), 0);
    console.log(`💰 Общий баланс пользователей: ${totalUserBalance.toFixed(2)} USDT`);
    
    // 2. Проверяем транзакции
    const deposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalDeposits = deposits[0]?.total || 0;
    console.log(`📥 Всего депозитов: ${totalDeposits.toFixed(2)} USDT`);
    
    const withdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    const totalWithdrawals = withdrawals[0]?.total || 0;
    console.log(`📤 Всего выводов: ${totalWithdrawals.toFixed(2)} USDT`);
    
    // 3. Проверяем игры
    const bets = await Transaction.aggregate([
      { $match: { type: 'bet', status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    const totalBets = bets[0]?.total || 0;
    console.log(`🎮 Всего ставок: ${totalBets.toFixed(2)} USDT`);
    
    const wins = await Transaction.aggregate([
      { $match: { type: 'win', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWins = wins[0]?.total || 0;
    console.log(`🏆 Всего выигрышей: ${totalWins.toFixed(2)} USDT`);
    
    // 4. Проверяем игровую статистику
    const games = await Game.find({});
    let gameProfit = 0;
    let gameBets = 0;
    let gameWins = 0;
    
    games.forEach(game => {
      gameBets += game.bet || 0;
      if (game.win) {
        gameWins += (game.bet + game.profit);
      }
      gameProfit += game.profit || 0;
    });
    
    console.log(`\n📊 СТАТИСТИКА ИГР:`);
    console.log(`- Всего игр: ${games.length}`);
    console.log(`- Сумма ставок (из Game): ${gameBets.toFixed(2)} USDT`);
    console.log(`- Сумма выигрышей (из Game): ${gameWins.toFixed(2)} USDT`);
    console.log(`- Прибыль казино (из Game): ${(gameBets - gameWins).toFixed(2)} USDT`);
    
    // 5. Сравниваем с финансами казино
    const casinoFinance = await CasinoFinance.getInstance();
    console.log(`\n💎 ФИНАНСЫ КАЗИНО:`);
    console.log(`- Баланс пользователей (CasinoFinance): ${casinoFinance.totalUserBalance.toFixed(2)} USDT`);
    console.log(`- Оперативный баланс: ${casinoFinance.operationalBalance.toFixed(2)} USDT`);
    console.log(`- Всего ставок (CasinoFinance): ${casinoFinance.totalBets.toFixed(2)} USDT`);
    console.log(`- Всего выигрышей (CasinoFinance): ${casinoFinance.totalWins.toFixed(2)} USDT`);
    
    // 6. Проверяем расхождения
    console.log(`\n⚠️  ПРОВЕРКА РАСХОЖДЕНИЙ:`);
    const balanceDiff = Math.abs(totalUserBalance - casinoFinance.totalUserBalance);
    if (balanceDiff > 0.01) {
      console.log(`❌ Расхождение в балансах пользователей: ${balanceDiff.toFixed(2)} USDT`);
    } else {
      console.log(`✅ Балансы пользователей совпадают`);
    }
    
    const betsDiff = Math.abs(totalBets - casinoFinance.totalBets);
    if (betsDiff > 0.01) {
      console.log(`❌ Расхождение в ставках: ${betsDiff.toFixed(2)} USDT`);
      console.log(`   Transaction: ${totalBets.toFixed(2)} vs CasinoFinance: ${casinoFinance.totalBets.toFixed(2)}`);
    } else {
      console.log(`✅ Суммы ставок совпадают`);
    }
    
    const winsDiff = Math.abs(totalWins - casinoFinance.totalWins);
    if (winsDiff > 0.01) {
      console.log(`❌ Расхождение в выигрышах: ${winsDiff.toFixed(2)} USDT`);
      console.log(`   Transaction: ${totalWins.toFixed(2)} vs CasinoFinance: ${casinoFinance.totalWins.toFixed(2)}`);
    } else {
      console.log(`✅ Суммы выигрышей совпадают`);
    }
    
    // 7. Расчет ожидаемого баланса
    const expectedBalance = totalDeposits - totalWithdrawals + (totalBets - totalWins);
    console.log(`\n💡 ОЖИДАЕМЫЙ БАЛАНС:`);
    console.log(`Депозиты (${totalDeposits.toFixed(2)}) - Выводы (${totalWithdrawals.toFixed(2)}) + Прибыль казино (${(totalBets - totalWins).toFixed(2)}) = ${expectedBalance.toFixed(2)} USDT`);
    console.log(`Фактический баланс пользователей: ${totalUserBalance.toFixed(2)} USDT`);
    console.log(`Разница: ${(totalUserBalance - expectedBalance).toFixed(2)} USDT`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Проверка завершена');
  }
}

// Запуск проверки
checkFinancialIntegrity();