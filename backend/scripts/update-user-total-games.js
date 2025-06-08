// backend/scripts/update-user-total-games.js
// Скрипт для обновления поля totalGames у всех пользователей

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

async function updateUserTotalGames() {
  try {
    console.log('🔄 Начинаем обновление totalGames для всех пользователей...');
    
    // Получаем всех пользователей
    const users = await User.find({}).select('_id totalGames');
    console.log(`📊 Найдено ${users.length} пользователей`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const user of users) {
      // Подсчитываем количество игр пользователя
      const actualTotalGames = await Game.countDocuments({ user: user._id });
      
      if (user.totalGames !== actualTotalGames) {
        await User.updateOne(
          { _id: user._id },
          { $set: { totalGames: actualTotalGames } }
        );
        console.log(`✅ Пользователь ${user._id}: ${user.totalGames} → ${actualTotalGames} игр`);
        updated++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\n📊 Результаты обновления:`);
    console.log(`✅ Обновлено: ${updated} пользователей`);
    console.log(`⏭️ Пропущено: ${skipped} пользователей`);
    console.log(`📈 Всего обработано: ${users.length} пользователей`);
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении totalGames:', error);
  }
}

async function main() {
  await connectDB();
  await updateUserTotalGames();
  
  console.log('🏁 Скрипт завершен');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});