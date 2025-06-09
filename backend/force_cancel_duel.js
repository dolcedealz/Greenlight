#!/usr/bin/env node

/**
 * Принудительная отмена дуэли через прямое обращение к MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Duel, User } = require('./src/models');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('FORCE_CANCEL');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ Подключение к MongoDB установлено');
  } catch (error) {
    logger.error('❌ Ошибка подключения к MongoDB:', error);
    throw error;
  }
}

async function forceCancelDuel() {
  try {
    const sessionId = "duel_1749471106226_julbexlog";
    
    logger.info(`🔧 Принудительная отмена дуэли: ${sessionId}`);
    
    // Находим дуэль
    const duel = await Duel.findOne({ sessionId });
    if (!duel) {
      logger.error('❌ Дуэль не найдена');
      return;
    }
    
    logger.info(`📋 Текущий статус дуэли: ${duel.status}`);
    logger.info(`👥 Участники: ${duel.challengerId} vs ${duel.opponentId || 'не присоединился'}`);
    logger.info(`💰 Сумма: ${duel.amount} USDT`);
    
    // Находим пользователей
    const challenger = await User.findOne({ telegramId: duel.challengerId });
    const opponent = duel.opponentId ? await User.findOne({ telegramId: duel.opponentId }) : null;
    
    if (!challenger) {
      logger.error('❌ Challenger не найден');
      return;
    }
    
    // Функция для разблокировки средств
    const unlockFunds = async (user, amount) => {
      if (!user) return;
      
      const lockedFund = user.lockedFunds.find(lf => 
        lf.reason === 'duel' && lf.amount === amount
      );
      
      if (lockedFund) {
        user.lockedFunds = user.lockedFunds.filter(lf => lf._id.toString() !== lockedFund._id.toString());
        user.balance += amount;
        await user.save();
        logger.info(`💰 Разблокировано ${amount} USDT для пользователя ${user.telegramId}`);
      } else {
        logger.warn(`⚠️ Заблокированные средства не найдены для пользователя ${user.telegramId}`);
      }
    };
    
    // Разблокируем средства участников
    await unlockFunds(challenger, duel.amount);
    if (opponent) {
      await unlockFunds(opponent, duel.amount);
    }
    
    // Обновляем статус дуэли
    duel.status = 'cancelled';
    duel.completedAt = new Date();
    await duel.save();
    
    logger.info('✅ Дуэль успешно отменена принудительно');
    logger.info(`📊 Финальный статус: ${duel.status}`);
    
    // Проверяем результат
    const updatedChallenger = await User.findOne({ telegramId: duel.challengerId });
    logger.info(`💳 Баланс challenger после отмены: ${updatedChallenger.balance} USDT`);
    logger.info(`🔒 Заблокированных средств: ${updatedChallenger.lockedFunds.length}`);
    
  } catch (error) {
    logger.error('❌ Ошибка при принудительной отмене:', error);
    throw error;
  }
}

async function main() {
  await connectDB();
  await forceCancelDuel();
  await mongoose.disconnect();
  logger.info('🔌 Соединение с БД закрыто');
}

// Запуск
main().catch(error => {
  logger.error('💥 Критическая ошибка:', error);
  process.exit(1);
});