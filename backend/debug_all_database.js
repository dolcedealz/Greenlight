// Универсальный скрипт отладки базы данных
const { User, Game, Transaction, ReferralEarning } = require('./src/models');
const mongoose = require('mongoose');

async function debugDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n=== ОБЩАЯ СТАТИСТИКА БАЗЫ ===');
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const totalEarnings = await ReferralEarning.countDocuments();
    
    console.log(`👥 Пользователей: ${totalUsers}`);
    console.log(`🎮 Игр: ${totalGames}`);
    console.log(`💰 Транзакций: ${totalTransactions}`);
    console.log(`🤝 Реферальных начислений: ${totalEarnings}`);
    
    // 1. ПРОВЕРКА ПАРТНЕРСКИХ СТАТУСОВ
    console.log('\n=== 1. ПРОВЕРКА ПАРТНЕРСКИХ СТАТУСОВ ===');
    const partners = await User.find({ 
      partnerLevel: { $ne: 'none' }
    }).select('username telegramId partnerLevel partnerMeta referralStats balance');
    
    console.log(`Найдено партнеров: ${partners.length}`);
    
    for (const partner of partners) {
      console.log(`\n🤝 Партнер: ${partner.username || partner.telegramId}`);
      console.log(`   Уровень: ${partner.partnerLevel}`);
      console.log(`   Баланс: ${partner.balance} USDT`);
      console.log(`   Назначен: ${partner.partnerMeta?.assignedAt || 'неизвестно'}`);
      console.log(`   Реферальный баланс: ${partner.referralStats?.referralBalance || 0} USDT`);
      console.log(`   Всего заработано: ${partner.referralStats?.totalEarned || 0} USDT`);
      
      // Проверяем рефералов этого партнера
      const referrals = await User.find({ referrer: partner._id });
      console.log(`   Рефералов: ${referrals.length}`);
    }
    
    // 2. ПРОВЕРКА СТАТИСТИКИ ИГР
    console.log('\n=== 2. ПРОВЕРКА СТАТИСТИКИ ИГР ===');
    const usersWithGames = await User.find({ 
      $or: [
        { totalGames: { $gt: 0 } },
        { totalWagered: { $gt: 0 } }
      ]
    }).limit(10);
    
    console.log(`Пользователей с играми: ${usersWithGames.length}`);
    
    for (const user of usersWithGames) {
      // Подсчитываем реальную статистику
      const actualGames = await Game.countDocuments({ user: user._id });
      const actualWagered = await Game.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, total: { $sum: '$bet' } } }
      ]);
      const actualWon = await Game.aggregate([
        { $match: { user: user._id } },
        { 
          $group: { 
            _id: null, 
            total: { 
              $sum: { 
                $cond: [
                  '$win', 
                  { $add: ['$bet', { $ifNull: ['$profit', 0] }] }, 
                  0
                ] 
              } 
            } 
          } 
        }
      ]);
      
      const realWagered = actualWagered[0]?.total || 0;
      const realWon = actualWon[0]?.total || 0;
      
      console.log(`\n🎮 Игрок: ${user.username || user.telegramId}`);
      console.log(`   Модель: игр=${user.totalGames}, ставок=${user.totalWagered}, выигрышей=${user.totalWon}`);
      console.log(`   Реальность: игр=${actualGames}, ставок=${realWagered}, выигрышей=${realWon}`);
      console.log(`   Баланс: ${user.balance} USDT`);
      
      // Проверяем расхождения
      const gamesDiff = user.totalGames !== actualGames;
      const wageredDiff = Math.abs(user.totalWagered - realWagered) > 0.01;
      const wonDiff = Math.abs(user.totalWon - realWon) > 0.01;
      
      if (gamesDiff || wageredDiff || wonDiff) {
        console.log(`   ❌ ПРОБЛЕМА: ${gamesDiff ? 'игры ' : ''}${wageredDiff ? 'ставки ' : ''}${wonDiff ? 'выигрыши' : ''}`);
      } else {
        console.log(`   ✅ Данные корректны`);
      }
    }
    
    // 3. ПРОВЕРКА РЕФЕРАЛЬНЫХ КОМИССИЙ
    console.log('\n=== 3. ПРОВЕРКА РЕФЕРАЛЬНЫХ КОМИССИЙ ===');
    
    // Находим всех пользователей с рефералами
    const usersWithReferrals = await User.find({
      'referralStats.totalReferrals': { $gt: 0 }
    });
    
    console.log(`Пользователей с рефералами: ${usersWithReferrals.length}`);
    
    for (const user of usersWithReferrals.slice(0, 5)) { // только первые 5
      console.log(`\n🤝 Реферер: ${user.username || user.telegramId}`);
      console.log(`   Партнерский статус: ${user.partnerLevel}`);
      console.log(`   Комиссия: ${user.referralStats?.commissionPercent || 0}%`);
      
      // Найти реальных рефералов
      const actualReferrals = await User.find({ referrer: user._id });
      console.log(`   Рефералов в модели: ${user.referralStats?.totalReferrals || 0}`);
      console.log(`   Рефералов реально: ${actualReferrals.length}`);
      
      // Проверить начисления
      const earnings = await ReferralEarning.find({ partner: user._id });
      const totalEarnedFromDB = earnings.reduce((sum, e) => sum + (e.calculation?.earnedAmount || 0), 0);
      
      console.log(`   Заработано в модели: ${user.referralStats?.totalEarned || 0} USDT`);
      console.log(`   Заработано в DB: ${totalEarnedFromDB.toFixed(2)} USDT`);
      console.log(`   Реферальный баланс: ${user.referralStats?.referralBalance || 0} USDT`);
      
      // Анализируем рефералов
      for (const ref of actualReferrals.slice(0, 2)) { // первые 2 реферала
        const refGames = await Game.countDocuments({ user: ref._id });
        const refWagered = await Game.aggregate([
          { $match: { user: ref._id } },
          { $group: { _id: null, total: { $sum: '$bet' } } }
        ]);
        
        const refEarnings = await ReferralEarning.find({ 
          partner: user._id, 
          referral: ref._id 
        });
        
        console.log(`     📱 Реферал: ${ref.username || ref.telegramId}`);
        console.log(`        Игр: ${refGames}, ставок: ${refWagered[0]?.total || 0}`);
        console.log(`        Комиссий: ${refEarnings.length}, сумма: ${refEarnings.reduce((s, e) => s + (e.calculation?.earnedAmount || 0), 0).toFixed(2)}`);
      }
    }
    
    // 4. ПРОВЕРКА ТРАНЗАКЦИЙ И БАЛАНСОВ
    console.log('\n=== 4. ПРОВЕРКА БАЛАНСОВ ===');
    
    const usersWithBalance = await User.find({ 
      balance: { $gt: 0 } 
    }).sort({ balance: -1 }).limit(10);
    
    console.log(`Пользователей с балансом: ${usersWithBalance.length}`);
    
    for (const user of usersWithBalance) {
      // Подсчитываем баланс из транзакций
      const transactions = await Transaction.find({ user: user._id });
      const calculatedBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      
      console.log(`\n💰 Пользователь: ${user.username || user.telegramId}`);
      console.log(`   Баланс в модели: ${user.balance} USDT`);
      console.log(`   Баланс из транзакций: ${calculatedBalance.toFixed(2)} USDT`);
      console.log(`   Разница: ${(user.balance - calculatedBalance).toFixed(2)} USDT`);
      console.log(`   Транзакций: ${transactions.length}`);
      
      if (Math.abs(user.balance - calculatedBalance) > 0.01) {
        console.log(`   ❌ ПРОБЛЕМА С БАЛАНСОМ`);
      } else {
        console.log(`   ✅ Баланс корректен`);
      }
    }
    
    // 5. ПРОВЕРКА ПОСЛЕДНИХ ИГРОВЫХ АКТИВНОСТЕЙ
    console.log('\n=== 5. ПРОВЕРКА ПОСЛЕДНИХ ИГР ===');
    
    const recentGames = await Game.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'username telegramId');
    
    console.log(`Последние ${recentGames.length} игр:`);
    
    for (const game of recentGames) {
      console.log(`🎮 ${game.gameType} | ${game.user?.username || game.user?.telegramId || 'Unknown'} | ${game.bet} USDT | ${game.win ? 'WIN' : 'LOSS'} | ${game.profit.toFixed(2)} | ${game.createdAt.toISOString().split('T')[0]}`);
    }
    
    // 6. ПОИСК КРИТИЧЕСКИХ ПРОБЛЕМ
    console.log('\n=== 6. КРИТИЧЕСКИЕ ПРОБЛЕМЫ ===');
    
    // Отрицательные балансы
    const negativeBalances = await User.find({ balance: { $lt: 0 } });
    console.log(`❌ Пользователей с отрицательным балансом: ${negativeBalances.length}`);
    
    // Игры без пользователей
    const orphanGames = await Game.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      {
        $match: {
          userDoc: { $size: 0 }
        }
      },
      {
        $count: 'orphanCount'
      }
    ]);
    console.log(`❌ Игр без пользователей: ${orphanGames[0]?.orphanCount || 0}`);
    
    // Транзакции без пользователей
    const orphanTransactions = await Transaction.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      {
        $match: {
          userDoc: { $size: 0 }
        }
      },
      {
        $count: 'orphanCount'
      }
    ]);
    console.log(`❌ Транзакций без пользователей: ${orphanTransactions[0]?.orphanCount || 0}`);
    
    console.log('\n✅ Отладка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при отладке:', error);
  } finally {
    mongoose.disconnect();
  }
}

debugDatabase();