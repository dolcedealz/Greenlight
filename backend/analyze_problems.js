const { User, Game } = require('./src/models');
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    
    console.log('=== АНАЛИЗ ПРОБЛЕМ ===');
    
    // Получаем всех пользователей
    const allUsers = await User.find({}).limit(10);
    console.log('Всего пользователей в базе:', await User.countDocuments());
    console.log('Игр в базе:', await Game.countDocuments());
    
    console.log('\nПроблемы с подсчетом игр:');
    for (const user of allUsers) {
      const actualGames = await Game.countDocuments({ user: user._id });
      const actualWagered = await Game.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, total: { $sum: '$bet' } } }
      ]);
      
      const dbWagered = actualWagered[0]?.total || 0;
      
      // Выводим информацию о каждом пользователе
      console.log(`Пользователь: ${user.username || user.telegramId}`);
      console.log(`  Модель: игр=${user.totalGames}, ставок=${user.totalWagered}, выигрышей=${user.totalWon}`);
      console.log(`  DB: игр=${actualGames}, ставок=${dbWagered}`);
      console.log(`  Баланс: ${user.balance}`);
      console.log(`  ReferralStats:`, user.referralStats);
      
      if (user.totalGames !== actualGames || Math.abs(user.totalWagered - dbWagered) > 0.01) {
        console.log(`  ❌ НЕСООТВЕТСТВИЕ!`);
      } else {
        console.log(`  ✅ Все совпадает`);
      }
      console.log('');
    }
    
    // Проверим есть ли пользователи с рефералами
    console.log('\nПоиск пользователей с рефералами:');
    const usersWithReferrals = await User.find({ 
      'referralStats.totalReferrals': { $gt: 0 } 
    });
    console.log('Пользователей с рефералами:', usersWithReferrals.length);
    
    for (const user of usersWithReferrals) {
      console.log(`Пользователь: ${user.username || user.telegramId}`);
      console.log(`  Рефералов: ${user.referralStats.totalReferrals}`);
      console.log(`  Заработано: ${user.referralStats.totalEarned}`);
      console.log(`  Баланс реферальный: ${user.referralStats.referralBalance}`);
      console.log(`  Партнерский уровень: ${user.partnerLevel}`);
      
      // Проверим реальных рефералов
      const actualReferrals = await User.countDocuments({ referrer: user._id });
      console.log(`  Реальных рефералов в DB: ${actualReferrals}`);
      console.log('');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
})();