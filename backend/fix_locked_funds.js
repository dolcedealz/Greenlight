// fix_locked_funds.js - Скрипт для исправления поля lockedFunds у существующих пользователей
require('dotenv').config();
const mongoose = require('mongoose');

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

// Импортируем модель пользователя
const User = require('./src/models/user.model');

async function fixLockedFunds() {
  try {
    console.log('🔧 Начинаем исправление поля lockedFunds...');
    
    // Находим всех пользователей, у которых lockedFunds не является массивом
    const usersToFix = await User.find({
      $or: [
        { lockedFunds: { $type: "number" } },  // Если lockedFunds - число
        { lockedFunds: { $exists: false } },   // Если lockedFunds не существует
        { lockedFunds: null }                  // Если lockedFunds равно null
      ]
    });
    
    console.log(`📊 Найдено пользователей для исправления: ${usersToFix.length}`);
    
    if (usersToFix.length === 0) {
      console.log('✅ Все пользователи уже имеют корректное поле lockedFunds');
      return;
    }
    
    // Исправляем каждого пользователя
    let fixedCount = 0;
    for (const user of usersToFix) {
      try {
        console.log(`🔧 Исправляем пользователя: ${user.telegramId} (${user.firstName})`);
        
        // Устанавливаем корректные значения по умолчанию
        const updates = {
          lockedFunds: [],
          totalWagered: user.totalWagered || 0,
          totalWon: user.totalWon || 0,
          totalGames: user.totalGames || 0
        };
        
        // Проверяем и исправляем freespins
        if (!user.freespins || typeof user.freespins !== 'object') {
          updates.freespins = {
            slots: 0,
            coin: 0,
            mines: 0
          };
        } else {
          // Убеждаемся, что все поля freespins присутствуют
          updates.freespins = {
            slots: user.freespins.slots || 0,
            coin: user.freespins.coin || 0,
            mines: user.freespins.mines || 0
          };
        }
        
        // Проверяем activeDepositBonuses
        if (!Array.isArray(user.activeDepositBonuses)) {
          updates.activeDepositBonuses = [];
        }
        
        await User.updateOne(
          { _id: user._id },
          { $set: updates }
        );
        
        fixedCount++;
        console.log(`✅ Пользователь ${user.telegramId} исправлен`);
        
      } catch (userError) {
        console.error(`❌ Ошибка исправления пользователя ${user.telegramId}:`, userError);
      }
    }
    
    console.log(`🎉 Исправление завершено! Исправлено пользователей: ${fixedCount}`);
    
    // Проверяем результат
    const remainingBrokenUsers = await User.find({
      $or: [
        { lockedFunds: { $type: "number" } },
        { lockedFunds: { $exists: false } },
        { lockedFunds: null }
      ]
    });
    
    if (remainingBrokenUsers.length === 0) {
      console.log('✅ Все пользователи успешно исправлены!');
    } else {
      console.log(`⚠️ Остались пользователи с проблемами: ${remainingBrokenUsers.length}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении lockedFunds:', error);
  }
}

async function main() {
  await connectDB();
  await fixLockedFunds();
  await mongoose.disconnect();
  console.log('🔌 Соединение с БД закрыто');
  process.exit(0);
}

// Запуск скрипта
main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});