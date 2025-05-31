// backend/scripts/migrate-referral-stats.js
const mongoose = require('mongoose');
const { User } = require('../src/models');

// Конфигурация подключения к БД
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight';

// Функция для генерации уникального реферального кода
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

async function migrateReferralStats() {
  try {
    console.log('🔄 Подключение к базе данных...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Подключение установлено');

    console.log('🔍 Поиск пользователей без referralStats...');
    
    // Находим всех пользователей без referralStats или без referralCode
    const usersToUpdate = await User.find({
      $or: [
        { referralStats: { $exists: false } },
        { referralStats: null },
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: '' }
      ]
    });

    console.log(`📊 Найдено пользователей для миграции: ${usersToUpdate.length}`);

    if (usersToUpdate.length === 0) {
      console.log('✅ Все пользователи уже имеют актуальную структуру referralStats');
      return;
    }

    let migrated = 0;
    let errors = 0;

    for (const user of usersToUpdate) {
      try {
        console.log(`🔄 Обрабатываем пользователя ${user._id} (${user.username || user.firstName})`);

        // Генерируем referralCode если его нет
        if (!user.referralCode) {
          let isUnique = false;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!isUnique && attempts < maxAttempts) {
            const code = generateReferralCode();
            const existingUser = await User.findOne({ referralCode: code });
            
            if (!existingUser) {
              user.referralCode = code;
              isUnique = true;
              console.log(`  📝 Создан реферальный код: ${code}`);
            }
            attempts++;
          }
          
          if (!isUnique) {
            const timestamp = Date.now().toString(36).toUpperCase();
            user.referralCode = 'REF' + timestamp.slice(-5);
            console.log(`  📝 Создан резервный код: ${user.referralCode}`);
          }
        }

        // Инициализируем referralStats если их нет
        if (!user.referralStats) {
          // Подсчитываем актуальную статистику
          const totalReferrals = await User.countDocuments({ referrer: user._id });
          const activeReferrals = await User.countDocuments({ 
            referrer: user._id,
            lastActivity: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // активные за последние 30 дней
          });

          // Определяем уровень на основе активных рефералов
          let level = 'bronze';
          let commissionPercent = 5;

          if (activeReferrals >= 101) {
            level = 'vip';
            commissionPercent = 15;
          } else if (activeReferrals >= 51) {
            level = 'platinum';
            commissionPercent = 12;
          } else if (activeReferrals >= 21) {
            level = 'gold';
            commissionPercent = 10;
          } else if (activeReferrals >= 6) {
            level = 'silver';
            commissionPercent = 7;
          }

          user.referralStats = {
            level: level,
            commissionPercent: commissionPercent,
            totalReferrals: totalReferrals,
            activeReferrals: activeReferrals,
            totalEarned: user.referralEarnings || 0, // Используем существующие данные
            referralBalance: user.referralEarnings || 0, // Переносим существующий баланс
            totalWithdrawn: 0,
            levelUpdatedAt: new Date(),
            lastPayoutAt: null
          };

          console.log(`  ✅ Инициализированы referralStats: уровень ${level}, рефералов ${activeReferrals}/${totalReferrals}`);
        }

        // Сохраняем пользователя
        await user.save();
        migrated++;
        console.log(`  ✅ Пользователь ${user._id} успешно обновлен`);

      } catch (error) {
        console.error(`  ❌ Ошибка обновления пользователя ${user._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Итоги миграции:');
    console.log(`✅ Успешно обновлено: ${migrated} пользователей`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📈 Процент успеха: ${((migrated / usersToUpdate.length) * 100).toFixed(1)}%`);

    // Проверяем результат
    console.log('\n🔍 Проверка результатов...');
    const usersWithoutStats = await User.countDocuments({
      $or: [
        { referralStats: { $exists: false } },
        { referralStats: null }
      ]
    });

    const usersWithoutCode = await User.countDocuments({
      $or: [
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: '' }
      ]
    });

    console.log(`📊 Пользователей без referralStats: ${usersWithoutStats}`);
    console.log(`📊 Пользователей без referralCode: ${usersWithoutCode}`);

    if (usersWithoutStats === 0 && usersWithoutCode === 0) {
      console.log('🎉 Миграция полностью завершена!');
    } else {
      console.log('⚠️  Остались пользователи для обработки');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Соединение с БД закрыто');
  }
}

// Запускаем миграцию
if (require.main === module) {
  migrateReferralStats()
    .then(() => {
      console.log('✅ Скрипт миграции завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершен с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { migrateReferralStats };