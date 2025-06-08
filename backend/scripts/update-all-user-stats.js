// backend/scripts/update-all-user-stats.js
// Скрипт для обновления всех статистических данных пользователей

const mongoose = require('mongoose');
require('dotenv').config();

// Подключаемся к базе данных
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('✅ Подключение к MongoDB установлено');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

// Импортируем модели
const User = require('../src/models/user.model');
const Game = require('../src/models/game.model');

async function updateAllUserStats() {
  try {
    console.log('🔄 Начинаем обновление статистики для всех пользователей...');
    
    // Получаем всех пользователей
    const users = await User.find({}).select('_id username totalGames totalWagered totalWon');
    console.log(`📊 Найдено ${users.length} пользователей`);
    
    let updated = 0;
    let processed = 0;
    
    for (const user of users) {
      processed++;
      
      // Подсчитываем реальную статистику из коллекции Game
      const [
        totalGamesResult,
        totalWageredResult,
        totalWonResult
      ] = await Promise.all([
        Game.countDocuments({ user: user._id }),
        Game.aggregate([
          { $match: { user: user._id } },
          { $group: { _id: null, total: { $sum: '$bet' } } }
        ]),
        Game.aggregate([
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
        ])
      ]);

      const actualTotalGames = totalGamesResult;
      const actualTotalWagered = totalWageredResult[0]?.total || 0;
      const actualTotalWon = totalWonResult[0]?.total || 0;

      // Проверяем, нужно ли обновление
      let needsUpdate = false;
      const updates = {};

      if (user.totalGames !== actualTotalGames) {
        updates.totalGames = actualTotalGames;
        needsUpdate = true;
      }

      if (Math.abs(user.totalWagered - actualTotalWagered) > 0.01) {
        updates.totalWagered = actualTotalWagered;
        needsUpdate = true;
      }

      if (Math.abs(user.totalWon - actualTotalWon) > 0.01) {
        updates.totalWon = actualTotalWon;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        console.log(`✅ ${user.username || user._id}: игр ${user.totalGames}→${actualTotalGames}, ставок ${user.totalWagered.toFixed(2)}→${actualTotalWagered.toFixed(2)}, выигрышей ${user.totalWon.toFixed(2)}→${actualTotalWon.toFixed(2)}`);
        updated++;
      }

      // Показываем прогресс каждые 100 пользователей
      if (processed % 100 === 0) {
        console.log(`📈 Обработано ${processed}/${users.length} пользователей...`);
      }
    }
    
    console.log(`\n📊 Результаты обновления:`);
    console.log(`✅ Обновлено: ${updated} пользователей`);
    console.log(`⏭️ Пропущено: ${users.length - updated} пользователей`);
    console.log(`📈 Всего обработано: ${users.length} пользователей`);
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики:', error);
  }
}

async function main() {
  await connectDB();
  await updateAllUserStats();
  
  console.log('🏁 Скрипт завершен');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});