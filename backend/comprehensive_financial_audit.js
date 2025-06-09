#!/usr/bin/env node

/**
 * КОМПЛЕКСНЫЙ ФИНАНСОВЫЙ АУДИТ
 * 
 * Проверяет все денежные потоки и сравнивает с реальным балансом CryptoBot
 * Создает детальный отчет о расхождениях
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
  EventBet,
  Promocode
} = require('./src/models');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('FINANCIAL_AUDIT');

class FinancialAuditor {
  constructor() {
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    this.auditResults = {
      timestamp: new Date(),
      checks: {},
      balances: {},
      discrepancies: [],
      recommendations: []
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
   * Получает реальный баланс CryptoBot
   */
  async getCryptoBotBalance() {
    try {
      if (!this.cryptoBotToken) {
        throw new Error('CryptoBot токен не настроен');
      }

      const response = await axios.get('https://pay.crypt.bot/api/getBalance', {
        headers: {
          'Crypto-Pay-API-Token': this.cryptoBotToken
        }
      });

      if (!response.data.ok) {
        throw new Error(`CryptoBot API ошибка: ${response.data.error?.name || 'Неизвестная ошибка'}`);
      }

      const usdtBalance = response.data.result.find(balance => balance.currency_code === 'USDT');
      if (!usdtBalance) {
        throw new Error('USDT баланс не найден в CryptoBot');
      }

      return {
        available: parseFloat(usdtBalance.available),
        onhold: parseFloat(usdtBalance.onhold || 0),
        total: parseFloat(usdtBalance.available) + parseFloat(usdtBalance.onhold || 0)
      };
    } catch (error) {
      logger.error('Ошибка получения баланса CryptoBot:', error);
      return {
        available: 0,
        onhold: 0,
        total: 0,
        error: error.message
      };
    }
  }

  /**
   * Аудит балансов пользователей
   */
  async auditUserBalances() {
    logger.info('🔍 Аудит балансов пользователей...');
    
    const userStats = await User.aggregate([
      { $match: { isBlocked: false } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalMainBalance: { $sum: '$balance' },
          totalReferralBalance: { $sum: '$referralStats.referralBalance' },
          usersWithBalance: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } },
          usersWithReferralBalance: { $sum: { $cond: [{ $gt: ['$referralStats.referralBalance', 0] }, 1, 0] } }
        }
      }
    ]);

    const result = userStats[0] || {
      totalUsers: 0,
      totalMainBalance: 0,
      totalReferralBalance: 0,
      usersWithBalance: 0,
      usersWithReferralBalance: 0
    };

    result.totalUserBalance = result.totalMainBalance + result.totalReferralBalance;

    this.auditResults.balances.users = result;
    logger.info(`   Пользователи: ${result.totalUsers}, с балансом: ${result.usersWithBalance}`);
    logger.info(`   Основной баланс: ${result.totalMainBalance.toFixed(2)} USDT`);
    logger.info(`   Реферальный баланс: ${result.totalReferralBalance.toFixed(2)} USDT`);
    logger.info(`   Общий баланс пользователей: ${result.totalUserBalance.toFixed(2)} USDT`);

    return result;
  }

  /**
   * Аудит депозитов и выводов
   */
  async auditDepositsWithdrawals() {
    logger.info('🔍 Аудит депозитов и выводов...');

    const [depositStats, withdrawalStats] = await Promise.all([
      Deposit.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      Withdrawal.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const deposits = {
      total: 0,
      paid: 0,
      pending: 0,
      failed: 0
    };

    const withdrawals = {
      total: 0,
      completed: 0,
      pending: 0,
      rejected: 0
    };

    depositStats.forEach(stat => {
      deposits[stat._id] = stat.totalAmount;
      if (stat._id === 'paid') deposits.total += stat.totalAmount;
    });

    withdrawalStats.forEach(stat => {
      withdrawals[stat._id] = stat.totalAmount;
      if (stat._id === 'completed') withdrawals.total += stat.totalAmount;
    });

    this.auditResults.balances.deposits = deposits;
    this.auditResults.balances.withdrawals = withdrawals;

    logger.info(`   Депозиты (paid): ${deposits.paid.toFixed(2)} USDT`);
    logger.info(`   Выводы (completed): ${withdrawals.completed.toFixed(2)} USDT`);
    logger.info(`   Чистый приток: ${(deposits.paid - withdrawals.completed).toFixed(2)} USDT`);

    return { deposits, withdrawals };
  }

  /**
   * Аудит всех игр и их результатов
   */
  async auditGames() {
    logger.info('🔍 Аудит всех игр...');

    const gameStats = await Game.aggregate([
      {
        $group: {
          _id: '$gameType',
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$bet' },
          totalWins: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } },
          totalProfit: { $sum: '$profit' }, // Прибыль игроков (отрицательная = прибыль казино)
          winningGames: { $sum: { $cond: ['$win', 1, 0] } }
        }
      }
    ]);

    let totalBets = 0;
    let totalWins = 0;
    let totalCasinoProfit = 0;

    const gameBreakdown = {};

    gameStats.forEach(stat => {
      const casinoProfit = stat.totalBets - stat.totalWins;
      gameBreakdown[stat._id] = {
        ...stat,
        casinoProfit,
        winRate: stat.totalGames > 0 ? (stat.winningGames / stat.totalGames * 100).toFixed(2) : 0
      };

      totalBets += stat.totalBets;
      totalWins += stat.totalWins;
      totalCasinoProfit += casinoProfit;
    });

    this.auditResults.balances.games = {
      totalBets,
      totalWins,
      totalCasinoProfit,
      breakdown: gameBreakdown
    };

    logger.info(`   Всего ставок: ${totalBets.toFixed(2)} USDT`);
    logger.info(`   Всего выигрышей: ${totalWins.toFixed(2)} USDT`);
    logger.info(`   Прибыль казино от игр: ${totalCasinoProfit.toFixed(2)} USDT`);

    return { totalBets, totalWins, totalCasinoProfit, gameBreakdown };
  }

  /**
   * Аудит дуэлей
   */
  async auditDuels() {
    logger.info('🔍 Аудит дуэлей...');

    const duelStats = await Duel.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalDuels: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommissions: { $sum: '$commission' }
        }
      }
    ]);

    const result = duelStats[0] || {
      totalDuels: 0,
      totalAmount: 0,
      totalCommissions: 0
    };

    this.auditResults.balances.duels = result;

    logger.info(`   Завершенных дуэлей: ${result.totalDuels}`);
    logger.info(`   Общий оборот: ${(result.totalAmount * 2).toFixed(2)} USDT`);
    logger.info(`   Комиссии с дуэлей: ${result.totalCommissions.toFixed(2)} USDT`);

    return result;
  }

  /**
   * Аудит событий
   */
  async auditEvents() {
    logger.info('🔍 Аудит событий...');

    const [eventStats, betStats] = await Promise.all([
      Event.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      EventBet.aggregate([
        {
          $group: {
            _id: null,
            totalBets: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalPotentialWin: { $sum: '$potentialWin' }
          }
        }
      ])
    ]);

    const events = {};
    eventStats.forEach(stat => {
      events[stat._id] = stat.count;
    });

    const bets = betStats[0] || {
      totalBets: 0,
      totalAmount: 0,
      totalPotentialWin: 0
    };

    // Рассчитываем выплаченные выигрыши
    const paidWinnings = await EventBet.aggregate([
      { $match: { status: 'won' } },
      { $group: { _id: null, total: { $sum: '$potentialWin' } } }
    ]);

    bets.paidWinnings = paidWinnings[0]?.total || 0;
    bets.eventProfit = bets.totalAmount - bets.paidWinnings;

    this.auditResults.balances.events = { events, bets };

    logger.info(`   Всего ставок на события: ${bets.totalBets}`);
    logger.info(`   Сумма ставок: ${bets.totalAmount.toFixed(2)} USDT`);
    logger.info(`   Выплачено выигрышей: ${bets.paidWinnings.toFixed(2)} USDT`);
    logger.info(`   Прибыль от событий: ${bets.eventProfit.toFixed(2)} USDT`);

    return { events, bets };
  }

  /**
   * Аудит реферальной системы
   */
  async auditReferrals() {
    logger.info('🔍 Аудит реферальной системы...');

    const [earningsStats, payoutsStats] = await Promise.all([
      ReferralEarning.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$calculation.earnedAmount' }
          }
        }
      ]),
      ReferralPayout.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const earnings = {};
    let totalEarnings = 0;
    earningsStats.forEach(stat => {
      earnings[stat._id] = stat.totalAmount;
      totalEarnings += stat.totalAmount;
    });

    const payouts = {};
    let totalPayouts = 0;
    payoutsStats.forEach(stat => {
      payouts[stat._id] = stat.totalAmount;
      if (stat._id === 'completed') totalPayouts += stat.totalAmount;
    });

    const result = {
      earnings,
      payouts,
      totalEarnings,
      totalPayouts,
      pendingPayouts: totalEarnings - totalPayouts
    };

    this.auditResults.balances.referrals = result;

    logger.info(`   Всего начислено: ${totalEarnings.toFixed(2)} USDT`);
    logger.info(`   Всего выплачено: ${totalPayouts.toFixed(2)} USDT`);
    logger.info(`   Остается к выплате: ${result.pendingPayouts.toFixed(2)} USDT`);

    return result;
  }

  /**
   * Аудит промокодов
   */
  async auditPromocodes() {
    logger.info('🔍 Аудит промокодов...');

    const promoStats = await Transaction.aggregate([
      { $match: { type: 'promocode_balance', status: 'completed' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const result = promoStats[0] || {
      count: 0,
      totalAmount: 0
    };

    this.auditResults.balances.promocodes = result;

    logger.info(`   Активаций промокодов: ${result.count}`);
    logger.info(`   Общая стоимость: ${result.totalAmount.toFixed(2)} USDT`);

    return result;
  }

  /**
   * Аудит комиссий CryptoBot
   */
  async auditCryptoBotFees() {
    logger.info('🔍 Аудит комиссий CryptoBot...');

    const feeStats = await Transaction.aggregate([
      { 
        $match: { 
          'payment.fee': { $exists: true, $gt: 0 },
          status: 'completed' 
        } 
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalFees: { $sum: '$payment.fee' }
        }
      }
    ]);

    let totalFees = 0;
    const feeBreakdown = {};

    feeStats.forEach(stat => {
      feeBreakdown[stat._id] = {
        count: stat.count,
        totalFees: stat.totalFees
      };
      totalFees += stat.totalFees;
    });

    this.auditResults.balances.cryptoBotFees = {
      totalFees,
      breakdown: feeBreakdown
    };

    logger.info(`   Общие комиссии CryptoBot: ${totalFees.toFixed(2)} USDT`);

    return { totalFees, feeBreakdown };
  }

  /**
   * Рассчитывает ожидаемый баланс системы
   */
  calculateExpectedBalance() {
    logger.info('🧮 Расчет ожидаемого баланса...');

    const balances = this.auditResults.balances;

    // Формула: Депозиты - Выводы - Баланс пользователей = Оперативный баланс
    const operationalBalance = balances.deposits.paid - balances.withdrawals.completed - balances.users.totalUserBalance;
    
    // Ожидаемый баланс CryptoBot = Оперативный + Пользователи
    const expectedCryptoBotBalance = operationalBalance + balances.users.totalUserBalance;

    // Альтернативный расчет через денежные потоки
    const alternativeCalculation = balances.deposits.paid - balances.withdrawals.completed;

    this.auditResults.calculations = {
      operationalBalance,
      expectedCryptoBotBalance,
      alternativeCalculation,
      userBalance: balances.users.totalUserBalance
    };

    logger.info(`   Оперативный баланс: ${operationalBalance.toFixed(2)} USDT`);
    logger.info(`   Ожидаемый баланс CryptoBot: ${expectedCryptoBotBalance.toFixed(2)} USDT`);
    logger.info(`   Альтернативный расчет: ${alternativeCalculation.toFixed(2)} USDT`);

    return {
      operationalBalance,
      expectedCryptoBotBalance,
      alternativeCalculation
    };
  }

  /**
   * Сравнивает с реальным балансом CryptoBot
   */
  async compareWithCryptoBot() {
    logger.info('⚖️ Сравнение с реальным балансом CryptoBot...');

    const cryptoBotBalance = await this.getCryptoBotBalance();
    const calculations = this.auditResults.calculations;

    this.auditResults.cryptoBotBalance = cryptoBotBalance;

    if (cryptoBotBalance.error) {
      this.auditResults.discrepancies.push({
        type: 'CRITICAL',
        message: `Не удалось получить баланс CryptoBot: ${cryptoBotBalance.error}`
      });
      return;
    }

    const difference = Math.abs(cryptoBotBalance.total - calculations.expectedCryptoBotBalance);
    const alternativeDifference = Math.abs(cryptoBotBalance.total - calculations.alternativeCalculation);

    logger.info(`   Реальный баланс CryptoBot: ${cryptoBotBalance.total.toFixed(2)} USDT`);
    logger.info(`   Ожидаемый баланс: ${calculations.expectedCryptoBotBalance.toFixed(2)} USDT`);
    logger.info(`   Расхождение: ${difference.toFixed(2)} USDT`);

    // Анализ расхождений
    if (difference > 0.01) {
      const discrepancyType = difference > 1.0 ? 'CRITICAL' : 'WARNING';
      this.auditResults.discrepancies.push({
        type: discrepancyType,
        message: `Расхождение с CryptoBot: ${difference.toFixed(2)} USDT`,
        details: {
          realBalance: cryptoBotBalance.total,
          expectedBalance: calculations.expectedCryptoBotBalance,
          difference
        }
      });
    }

    if (alternativeDifference < difference) {
      this.auditResults.discrepancies.push({
        type: 'INFO',
        message: `Альтернативный расчет ближе к реальности: ${alternativeDifference.toFixed(2)} USDT vs ${difference.toFixed(2)} USDT`
      });
    }
  }

  /**
   * Генерирует рекомендации
   */
  generateRecommendations() {
    const balances = this.auditResults.balances;
    const discrepancies = this.auditResults.discrepancies;

    // Проверка соотношения балансов
    if (balances.users.totalUserBalance > balances.deposits.paid * 1.1) {
      this.auditResults.recommendations.push({
        priority: 'HIGH',
        message: 'Баланс пользователей превышает депозиты более чем на 10% - возможны фантомные балансы'
      });
    }

    // Проверка реферальных выплат
    if (balances.referrals.pendingPayouts > balances.users.totalReferralBalance * 1.1) {
      this.auditResults.recommendations.push({
        priority: 'MEDIUM',
        message: 'Начисленные реферальные комиссии не соответствуют балансам пользователей'
      });
    }

    // Проверка критических расхождений
    if (discrepancies.some(d => d.type === 'CRITICAL')) {
      this.auditResults.recommendations.push({
        priority: 'CRITICAL',
        message: 'Обнаружены критические расхождения - требуется немедленная проверка'
      });
    }

    // Общие рекомендации
    this.auditResults.recommendations.push({
      priority: 'LOW',
      message: 'Регулярно запускайте данный аудит для контроля финансового состояния'
    });
  }

  /**
   * Запускает полный аудит
   */
  async runFullAudit() {
    try {
      logger.info('🚀 НАЧАЛО КОМПЛЕКСНОГО ФИНАНСОВОГО АУДИТА');
      
      await this.connectDB();

      // Выполняем все проверки
      await this.auditUserBalances();
      await this.auditDepositsWithdrawals();
      await this.auditGames();
      await this.auditDuels();
      await this.auditEvents();
      await this.auditReferrals();
      await this.auditPromocodes();
      await this.auditCryptoBotFees();

      // Расчеты и сравнения
      this.calculateExpectedBalance();
      await this.compareWithCryptoBot();
      this.generateRecommendations();

      logger.info('✅ АУДИТ ЗАВЕРШЕН');
      
      return this.auditResults;

    } catch (error) {
      logger.error('❌ Ошибка при проведении аудита:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
      logger.info('🔌 Соединение с БД закрыто');
    }
  }

  /**
   * Выводит детальный отчет
   */
  printDetailedReport() {
    const results = this.auditResults;
    
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('              📊 ДЕТАЛЬНЫЙ ФИНАНСОВЫЙ ОТЧЕТ');
    console.log('═'.repeat(80));
    console.log(`Время проведения: ${results.timestamp.toLocaleString()}`);
    console.log('');

    // Балансы
    console.log('💰 БАЛАНСЫ:');
    console.log(`   CryptoBot (реальный): ${results.cryptoBotBalance?.total?.toFixed(2) || 'ОШИБКА'} USDT`);
    console.log(`   Ожидаемый системный: ${results.calculations?.expectedCryptoBotBalance?.toFixed(2) || 'ОШИБКА'} USDT`);
    console.log(`   Баланс пользователей: ${results.balances.users?.totalUserBalance?.toFixed(2)} USDT`);
    console.log(`   Оперативный баланс: ${results.calculations?.operationalBalance?.toFixed(2)} USDT`);
    console.log('');

    // Движение средств
    console.log('💳 ДВИЖЕНИЕ СРЕДСТВ:');
    console.log(`   Депозиты: ${results.balances.deposits?.paid?.toFixed(2)} USDT`);
    console.log(`   Выводы: ${results.balances.withdrawals?.completed?.toFixed(2)} USDT`);
    console.log(`   Чистый приток: ${(results.balances.deposits?.paid - results.balances.withdrawals?.completed)?.toFixed(2)} USDT`);
    console.log('');

    // Игры
    console.log('🎮 ИГРЫ:');
    console.log(`   Общий оборот: ${results.balances.games?.totalBets?.toFixed(2)} USDT`);
    console.log(`   Выигрыши игроков: ${results.balances.games?.totalWins?.toFixed(2)} USDT`);
    console.log(`   Прибыль казино: ${results.balances.games?.totalCasinoProfit?.toFixed(2)} USDT`);
    console.log('');

    // Расхождения
    if (results.discrepancies.length > 0) {
      console.log('⚠️ ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ:');
      results.discrepancies.forEach((disc, i) => {
        console.log(`   ${i + 1}. [${disc.type}] ${disc.message}`);
      });
      console.log('');
    }

    // Рекомендации
    if (results.recommendations.length > 0) {
      console.log('💡 РЕКОМЕНДАЦИИ:');
      results.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. [${rec.priority}] ${rec.message}`);
      });
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('');
  }
}

// Запуск аудита
async function main() {
  const auditor = new FinancialAuditor();
  
  try {
    const results = await auditor.runFullAudit();
    auditor.printDetailedReport();
    
    // Сохраняем результаты в файл
    const fs = require('fs');
    const filename = `audit_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`📄 Детальные результаты сохранены в ${filename}`);
    
  } catch (error) {
    console.error('💥 КРИТИЧЕСКАЯ ОШИБКА АУДИТА:', error);
    process.exit(1);
  }
}

// Экспортируем для использования как модуль
module.exports = FinancialAuditor;

// Запускаем если вызван напрямую
if (require.main === module) {
  main();
}