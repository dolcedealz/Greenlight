// backend/scripts/migrate-game-settings.js
const mongoose = require('mongoose');
const { User } = require('../src/models');
const config = require('../src/config');

/**
 * Скрипт для добавления настроек игр всем существующим пользователям
 */
async function migrateGameSettings() {
  try {
    // Подключаемся к БД
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('✅ Подключение к MongoDB установлено');

    // Получаем всех пользователей без настроек игр
    const usersWithoutSettings = await User.find({
      $or: [
        { gameSettings: { $exists: false } },
        { 'gameSettings.slots': { $exists: false } },
        { 'gameSettings.mines': { $exists: false } },
        { 'gameSettings.crash': { $exists: false } }
      ]
    });

    console.log(`📊 Найдено пользователей для миграции: ${usersWithoutSettings.length}`);

    // Обновляем каждого пользователя
    let updated = 0;
    for (const user of usersWithoutSettings) {
      const updateData = {
        $set: {
          gameSettings: {
            coin: {
              winChanceModifier: user.gameSettings?.coin?.winChanceModifier || 0
            },
            slots: {
              rtpModifier: user.gameSettings?.slots?.rtpModifier || 0
            },
            mines: {
              mineChanceModifier: user.gameSettings?.mines?.mineChanceModifier || 0
            },
            crash: {
              crashModifier: user.gameSettings?.crash?.crashModifier || 0
            }
          }
        }
      };

      await User.updateOne({ _id: user._id }, updateData);
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`✅ Обновлено ${updated} пользователей...`);
      }
    }

    console.log(`\n✅ Миграция завершена! Обновлено ${updated} пользователей`);

    // Показываем статистику
    const totalUsers = await User.countDocuments();
    const usersWithModifiers = await User.countDocuments({
      $or: [
        { 'gameSettings.coin.winChanceModifier': { $ne: 0 } },
        { 'gameSettings.slots.rtpModifier': { $ne: 0 } },
        { 'gameSettings.mines.mineChanceModifier': { $ne: 0 } },
        { 'gameSettings.crash.crashModifier': { $ne: 0 } }
      ]
    });

    console.log('\n📊 Итоговая статистика:');
    console.log(`   Всего пользователей: ${totalUsers}`);
    console.log(`   С модификаторами: ${usersWithModifiers}`);

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Соединение с БД закрыто');
  }
}

// Запускаем миграцию
migrateGameSettings();