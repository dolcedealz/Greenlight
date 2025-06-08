// Комплексный аудит всей системы балансов, игр и реферальных начислений
const { User, Game, Transaction, ReferralEarning, ReferralPayout } = require('./src/models');
const mongoose = require('mongoose');

async function comprehensiveAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n🔍 === КОМПЛЕКСНЫЙ АУДИТ СИСТЕМЫ ===\n');
    
    // 1. ПРОВЕРКА ВСЕХ ИГР НА ОШИБКИ БАЛАНСОВ
    console.log('=== 1. АУДИТ ВСЕХ ИГР ===');
    const allGames = await Game.find({}).populate('user', 'username telegramId').sort({ createdAt: 1 });
    
    let gameErrors = 0;
    const userBalanceTracking = new Map();
    
    for (const game of allGames) {
      const userId = game.user._id.toString();
      const expectedBalanceAfter = game.balanceBefore + game.profit;
      
      // Проверяем математику игры
      if (Math.abs(game.balanceAfter - expectedBalanceAfter) > 0.01) {
        console.log(`\n❌ ОШИБКА В ИГРЕ ${game._id}:`);
        console.log(`   Пользователь: ${game.user.username || game.user.telegramId}`);
        console.log(`   Тип: ${game.gameType}, Ставка: ${game.bet}`);
        console.log(`   Баланс: ${game.balanceBefore} → ${game.balanceAfter}`);
        console.log(`   Должно быть: ${game.balanceBefore} + ${game.profit} = ${expectedBalanceAfter}`);
        console.log(`   Разница: ${(game.balanceAfter - expectedBalanceAfter).toFixed(2)}`);
        gameErrors++;
      }
      
      // Отслеживаем последовательность балансов
      if (!userBalanceTracking.has(userId)) {
        userBalanceTracking.set(userId, []);
      }
      userBalanceTracking.get(userId).push({
        gameId: game._id,
        date: game.createdAt,
        balanceBefore: game.balanceBefore,
        balanceAfter: game.balanceAfter,
        bet: game.bet,
        profit: game.profit,
        type: game.gameType
      });
    }
    
    console.log(`\n📊 Всего игр: ${allGames.length}`);
    console.log(`❌ Игр с ошибками: ${gameErrors}`);
    
    // 2. ПРОВЕРКА РЕФЕРАЛЬНЫХ НАЧИСЛЕНИЙ
    console.log('\n\n=== 2. АУДИТ РЕФЕРАЛЬНОЙ СИСТЕМЫ ===');
    
    // Находим всех партнеров и пользователей с реферальным уровнем
    const partners = await User.find({ 
      $or: [
        { partnerLevel: { $ne: 'none' } },
        { 'referralStats.totalReferrals': { $gt: 0 } }
      ]
    });
    
    console.log(`\n👥 Найдено партнеров/рефереров: ${partners.length}`);
    
    for (const partner of partners) {
      console.log(`\n🤝 ${partner.username || partner.telegramId}:`);
      console.log(`   Партнерский статус: ${partner.partnerLevel}`);
      console.log(`   Реферальный уровень: ${partner.referralStats.level}`);
      console.log(`   Процент комиссии: ${partner.partnerLevel !== 'none' ? 
        (partner.partnerLevel === 'partner_bronze' ? 20 : 
         partner.partnerLevel === 'partner_silver' ? 25 : 
         partner.partnerLevel === 'partner_gold' ? 30 : 0) : 
        partner.referralStats.commissionPercent}%`);
      console.log(`   Реферальный баланс: ${partner.referralStats.referralBalance} USDT`);
      console.log(`   Всего заработано: ${partner.referralStats.totalEarned} USDT`);
      console.log(`   Выведено: ${partner.referralStats.totalWithdrawn} USDT`);
      
      // Проверяем начисления
      const earnings = await ReferralEarning.find({ partner: partner._id });
      const totalEarnedFromDB = earnings.reduce((sum, e) => sum + (e.calculation?.earnedAmount || 0), 0);
      
      console.log(`   Начислений в БД: ${earnings.length}`);
      console.log(`   Сумма начислений в БД: ${totalEarnedFromDB.toFixed(2)} USDT`);
      
      if (Math.abs(totalEarnedFromDB - partner.referralStats.totalEarned) > 0.01) {
        console.log(`   ❌ НЕСООТВЕТСТВИЕ: totalEarned != сумма начислений`);
      }
      
      // Проверяем рефералов
      const referrals = await User.find({ referrer: partner._id });
      console.log(`   Рефералов в БД: ${referrals.length}`);
      
      // Считаем ожидаемую комиссию
      let expectedCommission = 0;
      for (const referral of referrals) {
        const refLostGames = await Game.find({ 
          user: referral._id,
          win: false 
        });
        
        const commissionPercent = partner.partnerLevel !== 'none' ? 
          (partner.partnerLevel === 'partner_bronze' ? 20 : 
           partner.partnerLevel === 'partner_silver' ? 25 : 
           partner.partnerLevel === 'partner_gold' ? 30 : 0) : 
          partner.referralStats.commissionPercent;
        
        for (const game of refLostGames) {
          expectedCommission += Math.abs(game.profit) * (commissionPercent / 100);
        }
      }
      
      console.log(`   Ожидаемая комиссия: ${expectedCommission.toFixed(2)} USDT`);
      
      if (Math.abs(expectedCommission - totalEarnedFromDB) > 0.01) {
        console.log(`   ❌ НЕДОПОЛУЧЕНО: ${(expectedCommission - totalEarnedFromDB).toFixed(2)} USDT`);
      }
    }
    
    // 3. ПРОВЕРКА ПОЛЬЗОВАТЕЛЕЙ С АНОМАЛЬНЫМИ БАЛАНСАМИ
    console.log('\n\n=== 3. ПОЛЬЗОВАТЕЛИ С АНОМАЛЬНЫМИ БАЛАНСАМИ ===');
    
    const allUsers = await User.find({});
    
    for (const user of allUsers) {
      // Считаем реальный баланс из транзакций
      const transactions = await Transaction.find({ user: user._id });
      const transactionBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      
      // Считаем игры
      const gameCount = await Game.countDocuments({ user: user._id });
      const gameStats = await Game.aggregate([
        { $match: { user: user._id } },
        { $group: { 
          _id: null, 
          totalBet: { $sum: '$bet' },
          totalWon: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } },
          totalProfit: { $sum: '$profit' }
        }}
      ]);
      
      const stats = gameStats[0] || { totalBet: 0, totalWon: 0, totalProfit: 0 };
      
      // Определяем начальный баланс (тестовый)
      const hasDeposit = transactions.some(t => t.type === 'deposit');
      const initialBalance = hasDeposit ? 0 : 100; // Если нет депозитов, предполагаем тестовый баланс 100
      
      const expectedBalance = initialBalance + transactionBalance;
      const balanceDiff = user.balance - expectedBalance;
      
      // Выводим только проблемные случаи
      if (Math.abs(balanceDiff) > 0.01 || (user.balance > 200 && gameCount === 0)) {
        console.log(`\n👤 ${user.username || user.telegramId}:`);
        console.log(`   Текущий баланс: ${user.balance} USDT`);
        console.log(`   Ожидаемый баланс: ${expectedBalance} USDT`);
        console.log(`   Разница: ${balanceDiff.toFixed(2)} USDT`);
        console.log(`   Игр: ${gameCount}, Ставок: ${stats.totalBet}, Выигрышей: ${stats.totalWon}`);
        console.log(`   Транзакций: ${transactions.length}`);
        
        if (user.balance > 200 && gameCount === 0) {
          console.log(`   ⚠️  ПОДОЗРИТЕЛЬНО: Большой баланс без игр!`);
        }
      }
    }
    
    // 4. ПРОВЕРКА ВЫВОДОВ С РЕФЕРАЛЬНОГО БАЛАНСА
    console.log('\n\n=== 4. АУДИТ ВЫВОДОВ С РЕФЕРАЛЬНОГО БАЛАНСА ===');
    
    const payouts = await ReferralPayout.find({}).populate('partner', 'username telegramId');
    console.log(`\nВсего выводов: ${payouts.length}`);
    
    for (const payout of payouts.slice(-10)) { // последние 10
      console.log(`\n💸 Вывод ${payout._id}:`);
      console.log(`   Партнер: ${payout.partner?.username || payout.partner?.telegramId}`);
      console.log(`   Сумма: ${payout.amount} USDT`);
      console.log(`   Статус: ${payout.status}`);
      console.log(`   Дата: ${payout.createdAt.toISOString()}`);
    }
    
    // 5. СТАТИСТИКА СИСТЕМЫ
    console.log('\n\n=== 5. ОБЩАЯ СТАТИСТИКА ===');
    
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const totalEarnings = await ReferralEarning.countDocuments();
    
    const totalUserBalance = allUsers.reduce((sum, u) => sum + u.balance, 0);
    const totalReferralBalance = allUsers.reduce((sum, u) => sum + (u.referralStats?.referralBalance || 0), 0);
    
    console.log(`\n📊 Статистика:`);
    console.log(`   Пользователей: ${totalUsers}`);
    console.log(`   Игр: ${totalGames}`);
    console.log(`   Транзакций: ${totalTransactions}`);
    console.log(`   Реферальных начислений: ${totalEarnings}`);
    console.log(`   Общий баланс пользователей: ${totalUserBalance.toFixed(2)} USDT`);
    console.log(`   Общий реферальный баланс: ${totalReferralBalance.toFixed(2)} USDT`);
    
    console.log('\n✅ Комплексный аудит завершен');
    
  } catch (error) {
    console.error('❌ Ошибка при аудите:', error);
  } finally {
    mongoose.disconnect();
  }
}

comprehensiveAudit();