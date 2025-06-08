const { User, Game, Transaction } = require('./src/models');
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    
    // Ищем всех партнеров
    const partners = await User.find({ 
      partnerLevel: { $ne: 'none' }
    });
    console.log('Всего партнеров:', partners.length);
    
    for (const partner of partners) {
      console.log('\n=== ПАРТНЕР ===');
      console.log('Username:', partner.username);
      console.log('TelegramId:', partner.telegramId);
      console.log('PartnerLevel:', partner.partnerLevel);
      console.log('Balance:', partner.balance);
      console.log('TotalGames in User Model:', partner.totalGames);
      console.log('TotalWagered in User Model:', partner.totalWagered);
      console.log('TotalWon in User Model:', partner.totalWon);
      console.log('ReferralStats:', partner.referralStats);
      
      // Подсчитываем реальную статистику из Games
      const actualGamesCount = await Game.countDocuments({ user: partner._id });
      const actualWagered = await Game.aggregate([
        { $match: { user: partner._id } },
        { $group: { _id: null, total: { $sum: '$bet' } } }
      ]);
      
      console.log('РЕАЛЬНАЯ СТАТИСТИКА ИЗ GAMES:');
      console.log('Игр в Game DB:', actualGamesCount);
      console.log('Поставлено в Game DB:', actualWagered[0]?.total || 0);
      
      // Найти рефералов
      const referrals = await User.find({ referrer: partner._id });
      console.log('Количество рефералов:', referrals.length);
      
      // Статистика по первому рефералу
      if (referrals.length > 0) {
        const ref = referrals[0];
        console.log('-- Главный реферал:', ref.username || ref.telegramId);
        console.log('   Balance:', ref.balance);
        console.log('   User Model - Games:', ref.totalGames, 'Wagered:', ref.totalWagered, 'Won:', ref.totalWon);
        
        const refGamesCount = await Game.countDocuments({ user: ref._id });
        const refWagered = await Game.aggregate([
          { $match: { user: ref._id } },
          { $group: { _id: null, total: { $sum: '$bet' } } }
        ]);
        console.log('   Game DB - Games:', refGamesCount, 'Wagered:', refWagered[0]?.total || 0);
        
        // Последние игры реферала
        const recentGames = await Game.find({ user: ref._id }).sort({ createdAt: -1 }).limit(3);
        console.log('   Последние игры:', recentGames.map(g => ({
          type: g.gameType,
          bet: g.bet,
          profit: g.profit,
          win: g.win,
          date: g.createdAt.toISOString().split('T')[0]
        })));
        
        // Поиск реферальных комиссий
        try {
          const ReferralEarning = require('./src/models/referral-earning.model');
          const earnings = await ReferralEarning.find({ 
            partner: partner._id,
            referral: ref._id 
          }).sort({ createdAt: -1 });
          console.log('   Комиссии с этого реферала:', earnings.map(e => ({
            amount: e.calculation.earnedAmount,
            baseAmount: e.calculation.baseAmount,
            percent: e.calculation.commissionPercent,
            type: e.type,
            date: e.createdAt.toISOString().split('T')[0]
          })));
        } catch (e) {
          console.log('   Ошибка поиска комиссий:', e.message);
        }
      }
    }
    
    // Проверим проблемы с подсчетом игр
    console.log('\n=== ПОИСК ПРОБЛЕМ ===');
    const problematicUsers = await User.find({}).limit(5);
    for (const user of problematicUsers) {
      const actualGames = await Game.countDocuments({ user: user._id });
      if (user.totalGames !== actualGames) {
        console.log('НЕСООТВЕТСТВИЕ игр:', user.username || user.telegramId, 'User Model:', user.totalGames, 'Game DB:', actualGames);
      }
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
})();