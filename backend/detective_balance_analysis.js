#!/usr/bin/env node

/**
 * ДЕТЕКТИВНЫЙ АНАЛИЗ РАСХОЖДЕНИЯ БАЛАНСОВ
 * 
 * Ищет точный источник расхождения в 0.32 USDT между CryptoBot и системой
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const { 
  User, 
  Game, 
  Transaction, 
  Deposit, 
  Withdrawal, 
  CasinoFinance,
  ReferralEarning,
  ReferralPayout,
  Duel,
  Event,
  EventBet
} = require('./src/models');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('BALANCE_DETECTIVE');

class BalanceDetective {
  constructor() {
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    this.findings = {
      timestamp: new Date(),
      suspiciousTransactions: [],
      missingFees: [],
      inconsistencies: [],
      chronologicalAnalysis: []
    };
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('✅ Подключение к MongoDB установлено');
    } catch (error) {
      logger.error('❌ Ошибка подключения к MongoDB:', error);
      throw error;
    }
  }

  /**
   * Проверяет каждый депозит на наличие правильной комиссии 3%
   */
  async analyzeDepositFees() {
    logger.info('🔍 Анализ комиссий по депозитам...');

    const deposits = await Deposit.find({ status: 'paid' }).sort({ createdAt: 1 });
    
    let totalMissingFees = 0;
    const suspiciousDeposits = [];

    for (const deposit of deposits) {
      const expectedFee = deposit.amount * 0.03;
      const expectedNetAmount = deposit.amount * 0.97;

      // Ищем соответствующую транзакцию
      const transaction = await Transaction.findOne({
        user: deposit.user,
        type: 'deposit',
        amount: { $in: [deposit.amount, expectedNetAmount] },
        createdAt: { 
          $gte: new Date(deposit.createdAt.getTime() - 60000),
          $lte: new Date(deposit.createdAt.getTime() + 60000)
        }
      });

      const actualFee = transaction?.payment?.fee || 0;
      const feeDifference = Math.abs(expectedFee - actualFee);

      if (feeDifference > 0.001) { // Больше 0.1 цента расхождение
        suspiciousDeposits.push({
          depositId: deposit._id,
          amount: deposit.amount,
          expectedFee: expectedFee.toFixed(4),
          actualFee: actualFee.toFixed(4),
          difference: feeDifference.toFixed(4),
          date: deposit.createdAt,
          transactionId: transaction?._id
        });
        totalMissingFees += feeDifference;
      }
    }

    this.findings.missingFees.deposits = {
      totalMissingFees: totalMissingFees.toFixed(4),
      suspiciousCount: suspiciousDeposits.length,
      details: suspiciousDeposits
    };

    logger.info(`   Проверено депозитов: ${deposits.length}`);
    logger.info(`   Подозрительных: ${suspiciousDeposits.length}`);
    logger.info(`   Недостающие комиссии: ${totalMissingFees.toFixed(4)} USDT`);

    return { totalMissingFees, suspiciousDeposits };
  }

  /**
   * Проверяет каждый вывод на наличие правильной комиссии 3%
   */
  async analyzeWithdrawalFees() {
    logger.info('🔍 Анализ комиссий по выводам...');

    const withdrawals = await Withdrawal.find({ status: 'completed' }).sort({ createdAt: 1 });
    
    let totalMissingFees = 0;
    const suspiciousWithdrawals = [];

    for (const withdrawal of withdrawals) {
      const expectedFee = withdrawal.amount * 0.03;
      const expectedNetAmount = withdrawal.amount * 0.97;

      // Ищем соответствующую транзакцию
      const transaction = await Transaction.findOne({
        user: withdrawal.user,
        type: 'withdrawal',
        amount: withdrawal.amount,
        createdAt: { 
          $gte: new Date(withdrawal.createdAt.getTime() - 60000),
          $lte: new Date(withdrawal.createdAt.getTime() + 60000)
        }
      });

      const actualFee = transaction?.payment?.fee || 0;
      const feeDifference = Math.abs(expectedFee - actualFee);

      if (feeDifference > 0.001) {
        suspiciousWithdrawals.push({
          withdrawalId: withdrawal._id,
          amount: withdrawal.amount,
          expectedFee: expectedFee.toFixed(4),
          actualFee: actualFee.toFixed(4),
          difference: feeDifference.toFixed(4),
          date: withdrawal.createdAt,
          transactionId: transaction?._id
        });
        totalMissingFees += feeDifference;
      }
    }

    this.findings.missingFees.withdrawals = {
      totalMissingFees: totalMissingFees.toFixed(4),
      suspiciousCount: suspiciousWithdrawals.length,
      details: suspiciousWithdrawals
    };

    logger.info(`   Проверено выводов: ${withdrawals.length}`);
    logger.info(`   Подозрительных: ${suspiciousWithdrawals.length}`);
    logger.info(`   Недостающие комиссии: ${totalMissingFees.toFixed(4)} USDT`);

    return { totalMissingFees, suspiciousWithdrawals };
  }

  /**
   * Ищет транзакции без соответствующих депозитов/выводов
   */
  async findOrphanTransactions() {
    logger.info('🔍 Поиск "сиротских" транзакций...');

    const orphanDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed' } },
      {
        $lookup: {
          from: 'deposits',
          let: { userId: '$user', amount: '$amount', date: '$createdAt' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    { $or: [
                      { $eq: ['$amount', '$$amount'] },
                      { $eq: ['$amount', { $multiply: ['$$amount', 1.0309] }] } // Обратный расчет 97% -> 100%
                    ]},
                    { $lte: [{ $abs: { $subtract: ['$createdAt', '$$date'] } }, 60000] }
                  ]
                }
              }
            }
          ],
          as: 'matchingDeposit'
        }
      },
      { $match: { matchingDeposit: { $size: 0 } } }
    ]);

    const orphanWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed' } },
      {
        $lookup: {
          from: 'withdrawals',
          let: { userId: '$user', amount: '$amount', date: '$createdAt' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    { $eq: ['$amount', '$$amount'] },
                    { $lte: [{ $abs: { $subtract: ['$createdAt', '$$date'] } }, 60000] }
                  ]
                }
              }
            }
          ],
          as: 'matchingWithdrawal'
        }
      },
      { $match: { matchingWithdrawal: { $size: 0 } } }
    ]);

    this.findings.suspiciousTransactions = {
      orphanDeposits: orphanDeposits.length,
      orphanWithdrawals: orphanWithdrawals.length,
      details: {
        deposits: orphanDeposits,
        withdrawals: orphanWithdrawals
      }
    };

    logger.info(`   Депозитные транзакции без депозитов: ${orphanDeposits.length}`);
    logger.info(`   Выводные транзакции без выводов: ${orphanWithdrawals.length}`);

    return { orphanDeposits, orphanWithdrawals };
  }

  /**
   * Проверяет балансы пользователей на аномалии
   */
  async analyzeUserBalanceAnomalies() {
    logger.info('🔍 Анализ аномалий в балансах пользователей...');

    // Пользователи с подозрительно высокими балансами
    const highBalanceUsers = await User.find({
      $or: [
        { balance: { $gt: 10 } },
        { 'referralStats.referralBalance': { $gt: 5 } }
      ],
      isBlocked: false
    }).select('_id telegramId balance referralStats.referralBalance createdAt');

    // Пользователи с отрицательными балансами
    const negativeBalanceUsers = await User.find({
      $or: [
        { balance: { $lt: 0 } },
        { 'referralStats.referralBalance': { $lt: 0 } }
      ]
    }).select('_id telegramId balance referralStats.referralBalance');

    // Анализ движения средств для подозрительных пользователей
    const suspiciousUsers = [];
    
    for (const user of highBalanceUsers) {
      const [deposits, withdrawals, games] = await Promise.all([
        Deposit.find({ user: user._id, status: 'paid' }),
        Withdrawal.find({ user: user._id, status: 'completed' }),
        Game.find({ user: user._id })
      ]);

      const totalDeposited = deposits.reduce((sum, d) => sum + d.amount, 0);
      const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
      const totalBets = games.reduce((sum, g) => sum + g.bet, 0);
      const totalWinnings = games.filter(g => g.win).reduce((sum, g) => sum + g.bet + g.profit, 0);

      const expectedBalance = totalDeposited - totalWithdrawn - totalBets + totalWinnings;
      const actualBalance = user.balance + user.referralStats.referralBalance;
      const balanceDifference = Math.abs(expectedBalance - actualBalance);

      if (balanceDifference > 0.1) { // Расхождение больше 10 центов
        suspiciousUsers.push({
          userId: user._id,
          telegramId: user.telegramId,
          actualBalance: actualBalance.toFixed(4),
          expectedBalance: expectedBalance.toFixed(4),
          difference: balanceDifference.toFixed(4),
          deposits: totalDeposited.toFixed(2),
          withdrawals: totalWithdrawn.toFixed(2),
          bets: totalBets.toFixed(2),
          winnings: totalWinnings.toFixed(2)
        });
      }
    }

    this.findings.inconsistencies.users = {
      highBalanceCount: highBalanceUsers.length,
      negativeBalanceCount: negativeBalanceUsers.length,
      suspiciousCount: suspiciousUsers.length,
      details: {
        highBalance: highBalanceUsers,
        negativeBalance: negativeBalanceUsers,
        suspicious: suspiciousUsers
      }
    };

    logger.info(`   Пользователи с высоким балансом: ${highBalanceUsers.length}`);
    logger.info(`   Пользователи с отрицательным балансом: ${negativeBalanceUsers.length}`);
    logger.info(`   Подозрительные расхождения: ${suspiciousUsers.length}`);

    return { highBalanceUsers, negativeBalanceUsers, suspiciousUsers };
  }

  /**
   * Хронологический анализ - ищет момент появления расхождения
   */
  async chronologicalAnalysis() {
    logger.info('🔍 Хронологический анализ расхождения...');

    // Группируем все операции по дням
    const dailyOperations = await Promise.all([
      // Депозиты по дням
      Deposit.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Выводы по дням
      Withdrawal.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Игры по дням
      Game.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            totalBets: { $sum: '$bet' },
            totalWins: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Объединяем данные по дням
    const dailyAnalysis = new Map();
    
    // Добавляем депозиты
    dailyOperations[0].forEach(day => {
      if (!dailyAnalysis.has(day._id)) {
        dailyAnalysis.set(day._id, { date: day._id, deposits: 0, withdrawals: 0, bets: 0, wins: 0 });
      }
      dailyAnalysis.get(day._id).deposits = day.totalAmount;
    });
    
    // Добавляем выводы
    dailyOperations[1].forEach(day => {
      if (!dailyAnalysis.has(day._id)) {
        dailyAnalysis.set(day._id, { date: day._id, deposits: 0, withdrawals: 0, bets: 0, wins: 0 });
      }
      dailyAnalysis.get(day._id).withdrawals = day.totalAmount;
    });
    
    // Добавляем игры
    dailyOperations[2].forEach(day => {
      if (!dailyAnalysis.has(day._id)) {
        dailyAnalysis.set(day._id, { date: day._id, deposits: 0, withdrawals: 0, bets: 0, wins: 0 });
      }
      const dayData = dailyAnalysis.get(day._id);
      dayData.bets = day.totalBets;
      dayData.wins = day.totalWins;
    });

    // Рассчитываем накопительный баланс по дням
    let cumulativeBalance = 0;
    const chronology = [];
    
    for (const [date, data] of Array.from(dailyAnalysis.entries()).sort()) {
      const dayFlow = data.deposits - data.withdrawals;
      cumulativeBalance += dayFlow;
      
      chronology.push({
        date,
        deposits: data.deposits.toFixed(2),
        withdrawals: data.withdrawals.toFixed(2),
        netFlow: dayFlow.toFixed(2),
        cumulativeBalance: cumulativeBalance.toFixed(2),
        bets: data.bets.toFixed(2),
        wins: data.wins.toFixed(2),
        gameProfit: (data.bets - data.wins).toFixed(2)
      });
    }

    this.findings.chronologicalAnalysis = chronology;

    logger.info(`   Проанализировано дней: ${chronology.length}`);
    logger.info(`   Финальный накопительный баланс: ${cumulativeBalance.toFixed(2)} USDT`);

    return chronology;
  }

  /**
   * Запускает полное детективное расследование
   */
  async investigate() {
    try {
      logger.info('🕵️ НАЧАЛО ДЕТЕКТИВНОГО РАССЛЕДОВАНИЯ РАСХОЖДЕНИЯ');
      
      await this.connectDB();

      // Выполняем все проверки
      const depositFees = await this.analyzeDepositFees();
      const withdrawalFees = await this.analyzeWithdrawalFees();
      const orphans = await this.findOrphanTransactions();
      const anomalies = await this.analyzeUserBalanceAnomalies();
      const chronology = await this.chronologicalAnalysis();

      // Подсчитываем общие находки
      const totalMissingFees = parseFloat(depositFees.totalMissingFees) + parseFloat(withdrawalFees.totalMissingFees);
      
      logger.info('');
      logger.info('🎯 ОСНОВНЫЕ НАХОДКИ:');
      logger.info(`   Недостающие комиссии по депозитам: ${depositFees.totalMissingFees} USDT`);
      logger.info(`   Недостающие комиссии по выводам: ${withdrawalFees.totalMissingFees} USDT`);
      logger.info(`   Общие недостающие комиссии: ${totalMissingFees.toFixed(4)} USDT`);
      logger.info(`   Подозрительные пользователи: ${anomalies.suspiciousUsers.length}`);
      logger.info(`   Сиротские транзакции: ${orphans.orphanDeposits.length + orphans.orphanWithdrawals.length}`);

      // Сравниваем с известным расхождением 0.32 USDT
      if (Math.abs(totalMissingFees - 0.32) < 0.05) {
        logger.info('');
        logger.info('🎉 ВЕРОЯТНО НАЙДЕНА ПРИЧИНА РАСХОЖДЕНИЯ!');
        logger.info(`   Недостающие комиссии (${totalMissingFees.toFixed(4)}) объясняют расхождение 0.32 USDT`);
      }

      return this.findings;

    } catch (error) {
      logger.error('❌ Ошибка при детективном расследовании:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
      logger.info('🔌 Соединение с БД закрыто');
    }
  }

  /**
   * Выводит детальный отчет расследования
   */
  printDetailedReport() {
    const findings = this.findings;
    
    console.log('\n');
    console.log('🕵️'.repeat(40));
    console.log('           ДЕТЕКТИВНЫЙ ОТЧЕТ РАССЛЕДОВАНИЯ');
    console.log('🕵️'.repeat(40));
    console.log(`Время: ${findings.timestamp.toLocaleString()}`);
    console.log('');

    // Недостающие комиссии
    if (findings.missingFees) {
      console.log('💸 НЕДОСТАЮЩИЕ КОМИССИИ:');
      if (findings.missingFees.deposits) {
        console.log(`   Депозиты: ${findings.missingFees.deposits.totalMissingFees} USDT (${findings.missingFees.deposits.suspiciousCount} случаев)`);
      }
      if (findings.missingFees.withdrawals) {
        console.log(`   Выводы: ${findings.missingFees.withdrawals.totalMissingFees} USDT (${findings.missingFees.withdrawals.suspiciousCount} случаев)`);
      }
      console.log('');
    }

    // Подозрительные транзакции
    if (findings.suspiciousTransactions) {
      console.log('🚨 ПОДОЗРИТЕЛЬНЫЕ ТРАНЗАКЦИИ:');
      console.log(`   Депозитные транзакции без депозитов: ${findings.suspiciousTransactions.orphanDeposits}`);
      console.log(`   Выводные транзакции без выводов: ${findings.suspiciousTransactions.orphanWithdrawals}`);
      console.log('');
    }

    // Аномалии пользователей
    if (findings.inconsistencies?.users) {
      console.log('👤 АНОМАЛИИ ПОЛЬЗОВАТЕЛЕЙ:');
      console.log(`   Пользователи с высоким балансом: ${findings.inconsistencies.users.highBalanceCount}`);
      console.log(`   Пользователи с отрицательным балансом: ${findings.inconsistencies.users.negativeBalanceCount}`);
      console.log(`   Подозрительные расхождения балансов: ${findings.inconsistencies.users.suspiciousCount}`);
      console.log('');
    }

    // Хронология (последние 5 дней)
    if (findings.chronologicalAnalysis && findings.chronologicalAnalysis.length > 0) {
      console.log('📅 ХРОНОЛОГИЯ (последние дни):');
      const lastDays = findings.chronologicalAnalysis.slice(-5);
      lastDays.forEach(day => {
        console.log(`   ${day.date}: +${day.deposits} -${day.withdrawals} = ${day.netFlow} USDT (накопительно: ${day.cumulativeBalance})`);
      });
      console.log('');
    }

    console.log('🕵️'.repeat(40));
    console.log('');
  }
}

// Запуск расследования
async function main() {
  const detective = new BalanceDetective();
  
  try {
    const findings = await detective.investigate();
    detective.printDetailedReport();
    
    // Сохраняем результаты в файл
    const fs = require('fs');
    const filename = `detective_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(findings, null, 2));
    console.log(`🔍 Детальные результаты расследования сохранены в ${filename}`);
    
  } catch (error) {
    console.error('💥 КРИТИЧЕСКАЯ ОШИБКА РАССЛЕДОВАНИЯ:', error);
    process.exit(1);
  }
}

// Экспортируем для использования как модуль
module.exports = BalanceDetective;

// Запускаем если вызван напрямую
if (require.main === module) {
  main();
}