// Скрипт для исправления балансов и реферальных комиссий
const { User, Game, Transaction, ReferralEarning } = require('./src/models');
const mongoose = require('mongoose');
const referralService = require('./src/services/referral.service');

async function fixBalances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n🔧 === ИСПРАВЛЕНИЕ БАЛАНСОВ И КОМИССИЙ ===');
    
    // 1. Исправляем баланс aiuserv
    console.log('\n📊 Исправление баланса aiuserv:');
    const aiuserv = await User.findOne({ username: 'aiuserv' });
    
    if (aiuserv) {
      // Подсчитываем реальный баланс из транзакций
      const transactions = await Transaction.find({ user: aiuserv._id });
      const realBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      
      console.log(`   Текущий баланс в модели: ${aiuserv.balance} USDT`);
      console.log(`   Реальный баланс из транзакций: ${realBalance} USDT`);
      
      // Обновляем баланс + начальный тестовый баланс
      const initialBalance = 100; // Тестовый начальный баланс
      const correctBalance = initialBalance + realBalance;
      
      await User.findByIdAndUpdate(aiuserv._id, {
        balance: correctBalance
      });
      
      console.log(`   ✅ Баланс исправлен на: ${correctBalance} USDT`);
    }
    
    // 2. Пересчитываем реферальные комиссии
    console.log('\n💰 Пересчет реферальных комиссий:');
    
    // Находим всех партнеров
    const partners = await User.find({ 
      partnerLevel: { $ne: 'none' }
    });
    
    for (const partner of partners) {
      console.log(`\n🤝 Партнер: ${partner.username} (${partner.partnerLevel})`);
      
      // Находим всех рефералов партнера
      const referrals = await User.find({ referrer: partner._id });
      console.log(`   Рефералов: ${referrals.length}`);
      
      let totalMissedCommission = 0;
      
      for (const referral of referrals) {
        // Находим все проигрышные игры реферала
        const lostGames = await Game.find({ 
          user: referral._id,
          win: false 
        });
        
        // Проверяем какие комиссии уже начислены
        const existingEarnings = await ReferralEarning.find({
          partner: partner._id,
          referral: referral._id,
          type: 'game_loss'
        });
        
        const processedGameIds = existingEarnings.map(e => e.game?.toString());
        
        // Находим игры без начисленной комиссии
        const unprocessedGames = lostGames.filter(g => 
          !processedGameIds.includes(g._id.toString())
        );
        
        if (unprocessedGames.length > 0) {
          console.log(`   📱 Реферал ${referral.username}: найдено ${unprocessedGames.length} игр без комиссии`);
          
          for (const game of unprocessedGames) {
            const lossAmount = Math.abs(game.profit);
            const commissionPercent = partner.partnerLevel === 'partner_bronze' ? 20 : 
                                    partner.partnerLevel === 'partner_silver' ? 25 :
                                    partner.partnerLevel === 'partner_gold' ? 30 : 5;
            const missedCommission = lossAmount * (commissionPercent / 100);
            
            totalMissedCommission += missedCommission;
            console.log(`      - Игра ${game.gameType}: проигрыш ${lossAmount} USDT, упущенная комиссия ${missedCommission.toFixed(2)} USDT`);
          }
        }
      }
      
      if (totalMissedCommission > 0) {
        console.log(`   ❌ Всего упущенной комиссии: ${totalMissedCommission.toFixed(2)} USDT`);
        console.log(`   💡 Для начисления запустите скрипт recalculate_commissions.js`);
      } else {
        console.log(`   ✅ Все комиссии начислены корректно`);
      }
    }
    
    // 3. Исправляем статистику пользователей
    console.log('\n📈 Обновление статистики пользователей:');
    
    const allUsers = await User.find({});
    let fixedCount = 0;
    
    for (const user of allUsers) {
      const actualGames = await Game.countDocuments({ user: user._id });
      const actualWagered = await Game.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, total: { $sum: '$bet' } } }
      ]);
      const actualWon = await Game.aggregate([
        { $match: { user: user._id, win: true } },
        { $group: { _id: null, total: { $sum: { $add: ['$bet', '$profit'] } } } }
      ]);
      
      const realWagered = actualWagered[0]?.total || 0;
      const realWon = actualWon[0]?.total || 0;
      
      if (user.totalGames !== actualGames || 
          Math.abs(user.totalWagered - realWagered) > 0.01 ||
          Math.abs(user.totalWon - realWon) > 0.01) {
        
        await User.findByIdAndUpdate(user._id, {
          totalGames: actualGames,
          totalWagered: realWagered,
          totalWon: realWon
        });
        
        fixedCount++;
        console.log(`   ✅ Исправлена статистика для ${user.username || user.telegramId}`);
      }
    }
    
    console.log(`\n✅ Исправлено ${fixedCount} пользователей`);
    console.log('✅ Исправление завершено');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixBalances();