// Скрипт для исправления расчета totalWon в статистике пользователей
const { User, Game, Transaction } = require('./src/models');
const mongoose = require('mongoose');

async function fixTotalWon() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n🔧 === ИСПРАВЛЕНИЕ СТАТИСТИКИ TOTALWON ===');
    
    const allUsers = await User.find({});
    let fixedCount = 0;
    
    for (const user of allUsers) {
      // Подсчитываем правильную статистику из игр
      const gameStats = await Game.aggregate([
        { $match: { user: user._id } },
        { 
          $group: { 
            _id: null,
            totalGames: { $sum: 1 },
            totalWagered: { $sum: '$bet' },
            // totalWon = сумма всех выигрышей (bet + profit для выигрышных игр)
            totalWon: { 
              $sum: { 
                $cond: [
                  '$win', 
                  { $add: ['$bet', '$profit'] }, // Возвращаемая сумма при выигрыше
                  0 
                ] 
              } 
            },
            totalProfit: { $sum: '$profit' } // Общая прибыль/убыток
          }
        }
      ]);
      
      const stats = gameStats[0] || { 
        totalGames: 0, 
        totalWagered: 0, 
        totalWon: 0, 
        totalProfit: 0 
      };
      
      // Проверяем, нужно ли обновление
      const needsUpdate = (
        user.totalGames !== stats.totalGames ||
        Math.abs(user.totalWagered - stats.totalWagered) > 0.01 ||
        Math.abs(user.totalWon - stats.totalWon) > 0.01
      );
      
      if (needsUpdate) {
        console.log(`\n🔧 Исправление статистики ${user.username || user.telegramId}:`);
        console.log(`   Игр: ${user.totalGames} → ${stats.totalGames}`);
        console.log(`   Поставлено: ${user.totalWagered} → ${stats.totalWagered.toFixed(2)} USDT`);
        console.log(`   Выиграно: ${user.totalWon} → ${stats.totalWon.toFixed(2)} USDT`);
        console.log(`   Прибыль: ${stats.totalProfit.toFixed(2)} USDT`);
        
        await User.findByIdAndUpdate(user._id, {
          totalGames: stats.totalGames,
          totalWagered: stats.totalWagered,
          totalWon: stats.totalWon,
          lastActivity: user.lastActivity // Сохраняем последнюю активность
        });
        
        fixedCount++;
      }
    }
    
    console.log(`\n✅ Исправлено пользователей: ${fixedCount}`);
    
    // Проверяем транзакции выигрышей
    console.log('\n🔧 Проверка транзакций выигрышей...');
    
    const winTransactions = await Transaction.find({ type: 'win' });
    const gameWins = await Game.find({ win: true });
    
    console.log(`📊 Транзакций выигрышей: ${winTransactions.length}`);
    console.log(`📊 Выигрышных игр: ${gameWins.length}`);
    
    if (winTransactions.length !== gameWins.length) {
      console.log(`⚠️  НЕСООТВЕТСТВИЕ: Количество транзакций выигрышей не совпадает с количеством выигрышных игр`);
      
      // Проверяем, у каких игр нет транзакций
      let missingTransactions = 0;
      for (const game of gameWins) {
        const transaction = winTransactions.find(t => 
          t.game && t.game.toString() === game._id.toString()
        );
        if (!transaction) {
          missingTransactions++;
        }
      }
      console.log(`❌ Игр без транзакций выигрышей: ${missingTransactions}`);
    }
    
    console.log('✅ Исправление завершено');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixTotalWon();