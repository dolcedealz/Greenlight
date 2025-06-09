#!/usr/bin/env node

/**
 * Скрипт для исправления финансовой логики
 * 
 * Правильная формула:
 * Баланс CryptoBot = Оперативный баланс + Баланс пользователей
 * 
 * Где:
 * - Оперативный баланс = Депозиты - Выводы - Баланс пользователей
 * - Баланс пользователей = Сумма всех балансов (основной + реферальный)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { CasinoFinance, User, Deposit, Withdrawal, Game, Transaction } = require('./src/models');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('FIX_FINANCE');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ Подключение к MongoDB установлено');
  } catch (error) {
    logger.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
}

async function fixFinancialLogic() {
  try {
    logger.info('🔧 Начинаем исправление финансовой логики...');
    
    // Получаем или создаем запись финансов
    let finance = await CasinoFinance.findOne();
    if (!finance) {
      finance = new CasinoFinance();
      logger.info('📝 Создана новая запись финансов казино');
    }
    
    // 1. Рассчитываем общий баланс всех пользователей
    const userBalanceResult = await User.aggregate([
      { $match: { isBlocked: false } },
      { 
        $group: { 
          _id: null, 
          regularBalance: { $sum: '$balance' },
          referralBalance: { $sum: '$referralStats.referralBalance' }
        } 
      }
    ]);
    
    const regularBalance = userBalanceResult[0]?.regularBalance || 0;
    const referralBalance = userBalanceResult[0]?.referralBalance || 0;
    const totalUserBalance = regularBalance + referralBalance;
    
    logger.info(`💰 Баланс пользователей:`);
    logger.info(`   - Основной: ${regularBalance.toFixed(2)} USDT`);
    logger.info(`   - Реферальный: ${referralBalance.toFixed(2)} USDT`);
    logger.info(`   - Общий: ${totalUserBalance.toFixed(2)} USDT`);
    
    // 2. Рассчитываем суммы депозитов и выводов
    const [depositStats, withdrawalStats] = await Promise.all([
      Deposit.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Withdrawal.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    
    const totalDeposits = depositStats[0]?.total || 0;
    const totalWithdrawals = withdrawalStats[0]?.total || 0;
    
    logger.info(`💳 Движение средств:`);
    logger.info(`   - Всего депозитов: ${totalDeposits.toFixed(2)} USDT`);
    logger.info(`   - Всего выводов: ${totalWithdrawals.toFixed(2)} USDT`);
    
    // 3. Рассчитываем правильный оперативный баланс
    const operationalBalance = totalDeposits - totalWithdrawals - totalUserBalance;
    
    logger.info(`📊 Расчет оперативного баланса:`);
    logger.info(`   Формула: Депозиты - Выводы - Баланс пользователей`);
    logger.info(`   ${totalDeposits.toFixed(2)} - ${totalWithdrawals.toFixed(2)} - ${totalUserBalance.toFixed(2)} = ${operationalBalance.toFixed(2)} USDT`);
    
    // 4. Ожидаемый баланс CryptoBot
    const expectedCryptoBotBalance = operationalBalance + totalUserBalance;
    
    logger.info(`🎯 Ожидаемый баланс CryptoBot:`);
    logger.info(`   Формула: Оперативный + Баланс пользователей`);
    logger.info(`   ${operationalBalance.toFixed(2)} + ${totalUserBalance.toFixed(2)} = ${expectedCryptoBotBalance.toFixed(2)} USDT`);
    
    // 5. Обновляем запись финансов
    finance.totalUserBalance = totalUserBalance;
    finance.totalDeposits = totalDeposits;
    finance.totalWithdrawals = totalWithdrawals;
    finance.operationalBalance = operationalBalance;
    
    // 6. Также обновляем статистику игр для полноты картины
    const gameStats = await Game.aggregate([
      {
        $group: {
          _id: '$gameType',
          totalBets: { $sum: '$bet' },
          totalWins: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } },
          totalGames: { $sum: 1 }
        }
      }
    ]);
    
    finance.totalBets = 0;
    finance.totalWins = 0;
    
    gameStats.forEach(stat => {
      if (finance.gameStats[stat._id]) {
        finance.gameStats[stat._id].totalBets = stat.totalBets;
        finance.gameStats[stat._id].totalWins = stat.totalWins;
        finance.gameStats[stat._id].totalGames = stat.totalGames;
        finance.gameStats[stat._id].profit = stat.totalBets - stat.totalWins;
        
        finance.totalBets += stat.totalBets;
        finance.totalWins += stat.totalWins;
      }
    });
    
    const gameProfit = finance.totalBets - finance.totalWins;
    logger.info(`🎮 Прибыль от игр: ${gameProfit.toFixed(2)} USDT`);
    logger.info(`   (Это уже учтено в балансах пользователей)`);
    
    // 7. Пересчитываем резерв
    finance.calculateReserve();
    finance.checkWarnings();
    finance.lastCalculated = new Date();
    
    await finance.save();
    
    logger.info('✅ Финансовая логика исправлена!');
    
    // 8. Проверяем результат
    logger.info('');
    logger.info('📋 ИТОГОВЫЙ ОТЧЕТ:');
    logger.info(`   Баланс пользователей: ${finance.totalUserBalance.toFixed(2)} USDT`);
    logger.info(`   Оперативный баланс: ${finance.operationalBalance.toFixed(2)} USDT`);
    logger.info(`   Ожидаемый баланс CryptoBot: ${expectedCryptoBotBalance.toFixed(2)} USDT`);
    logger.info(`   Резерв (${finance.reservePercentage}%): ${finance.reserveBalance.toFixed(2)} USDT`);
    logger.info(`   Доступно для вывода: ${finance.availableForWithdrawal.toFixed(2)} USDT`);
    
    return {
      success: true,
      totalUserBalance,
      operationalBalance,
      expectedCryptoBotBalance,
      totalDeposits,
      totalWithdrawals
    };
    
  } catch (error) {
    logger.error('❌ Ошибка при исправлении финансовой логики:', error);
    throw error;
  }
}

async function main() {
  await connectDB();
  await fixFinancialLogic();
  await mongoose.disconnect();
  logger.info('🔌 Соединение с БД закрыто');
  process.exit(0);
}

// Запуск скрипта
main().catch(error => {
  logger.error('❌ Критическая ошибка:', error);
  process.exit(1);
});