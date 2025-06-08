#!/usr/bin/env node

/**
 * ПОЛНЫЙ СБРОС ТЕСТОВЫХ ДАННЫХ
 * 
 * Этот скрипт удаляет ВСЕ тестовые данные из базы и готовит систему 
 * для работы с реальными деньгами.
 * 
 * ВНИМАНИЕ: Операция необратима!
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Импортируем все модели
const User = require('./src/models/user.model');
const Game = require('./src/models/game.model');
const Transaction = require('./src/models/transaction.model');
const Deposit = require('./src/models/deposit.model');
const Withdrawal = require('./src/models/withdrawal.model');
const CasinoFinance = require('./src/models/casino-finance.model');
const ReferralEarning = require('./src/models/referral-earning.model');
const ReferralPayout = require('./src/models/referral-payout.model');
const Promocode = require('./src/models/promocode.model');
const CrashRound = require('./src/models/crash-round.model');
const CrashHistory = require('./src/models/crash-history.model');
const Duel = require('./src/models/duel.model');
const DuelRound = require('./src/models/duel-round.model');
const DuelInvitation = require('./src/models/duel-invitation.model');
const Event = require('./src/models/Event');
const EventBet = require('./src/models/EventBet');
const PartnerLog = require('./src/models/partner-log.model');

class DataResetService {
  constructor() {
    this.resetLog = [];
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.resetLog.push(logMessage);
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      this.log('✅ Подключение к MongoDB установлено');
    } catch (error) {
      this.log(`❌ Ошибка подключения к MongoDB: ${error.message}`);
      throw error;
    }
  }

  async resetUsers() {
    this.log('🔄 Сброс пользователей...');
    
    // Сбрасываем балансы и статистику, но оставляем основную информацию
    const result = await User.updateMany(
      {},
      {
        $set: {
          balance: 0,
          totalWagered: 0,
          totalWon: 0,
          totalGames: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          'referralStats.referralBalance': 0,
          'referralStats.totalEarned': 0,
          'referralStats.totalWithdrawn': 0,
          'referralStats.totalReferrals': 0,
          'referralStats.activeReferrals': 0,
          'referralStats.level': 'bronze',
          'referralStats.commissionPercent': 5,
          freespins: {},
          activeDepositBonuses: [],
          lockedFunds: [],
          'gameStats.totalGames': 0,
          'gameStats.totalWagered': 0,
          'gameStats.totalWon': 0,
          'gameStats.winRate': 0,
          'gameStats.biggestWin': 0,
          'gameStats.currentStreak': 0,
          'gameStats.bestStreak': 0,
          'gameStats.favoriteGame': null,
          'gameStats.lastGame': null,
          // Сбрасываем модификаторы шансов выигрыша
          'gameSettings.coinWinChance': 50,
          'gameSettings.minesWinModifier': 1,
          'gameSettings.slotsWinModifier': 1
        }
      }
    );
    
    this.log(`✅ Сброшено ${result.modifiedCount} пользователей`);
  }

  async resetGames() {
    this.log('🔄 Удаление всех игр...');
    
    const gamesCount = await Game.countDocuments();
    await Game.deleteMany({});
    
    this.log(`✅ Удалено ${gamesCount} игр`);
  }

  async resetTransactions() {
    this.log('🔄 Удаление всех транзакций...');
    
    const transactionsCount = await Transaction.countDocuments();
    await Transaction.deleteMany({});
    
    this.log(`✅ Удалено ${transactionsCount} транзакций`);
  }

  async resetDepositsWithdrawals() {
    this.log('🔄 Удаление депозитов и выводов...');
    
    const depositsCount = await Deposit.countDocuments();
    const withdrawalsCount = await Withdrawal.countDocuments();
    
    await Deposit.deleteMany({});
    await Withdrawal.deleteMany({});
    
    this.log(`✅ Удалено ${depositsCount} депозитов и ${withdrawalsCount} выводов`);
  }

  async resetReferralData() {
    this.log('🔄 Сброс реферальных данных...');
    
    const earningsCount = await ReferralEarning.countDocuments();
    const payoutsCount = await ReferralPayout.countDocuments();
    const partnerLogsCount = await PartnerLog.countDocuments();
    
    await ReferralEarning.deleteMany({});
    await ReferralPayout.deleteMany({});
    await PartnerLog.deleteMany({});
    
    this.log(`✅ Удалено ${earningsCount} начислений, ${payoutsCount} выплат, ${partnerLogsCount} логов`);
  }

  async resetPromocodes() {
    this.log('🔄 Сброс промокодов...');
    
    // Очищаем активации промокодов, но оставляем сами промокоды
    const result = await Promocode.updateMany(
      {},
      {
        $set: {
          usedCount: 0,
          activatedBy: [],
          'stats.totalActivated': 0,
          'stats.totalValue': 0,
          'stats.averageUserValue': 0,
          'stats.successRate': 0,
          'stats.lastActivation': null
        }
      }
    );
    
    this.log(`✅ Сброшено ${result.modifiedCount} промокодов`);
  }

  async resetCrashData() {
    this.log('🔄 Удаление данных Crash игры...');
    
    const roundsCount = await CrashRound.countDocuments();
    const historyCount = await CrashHistory.countDocuments();
    
    await CrashRound.deleteMany({});
    await CrashHistory.deleteMany({});
    
    this.log(`✅ Удалено ${roundsCount} раундов и ${historyCount} записей истории Crash`);
  }

  async resetDuels() {
    this.log('🔄 Удаление дуэлей...');
    
    const duelsCount = await Duel.countDocuments();
    const duelRoundsCount = await DuelRound.countDocuments();
    const invitationsCount = await DuelInvitation.countDocuments();
    
    await Duel.deleteMany({});
    await DuelRound.deleteMany({});
    await DuelInvitation.deleteMany({});
    
    this.log(`✅ Удалено ${duelsCount} дуэлей, ${duelRoundsCount} раундов, ${invitationsCount} приглашений`);
  }

  async resetEvents() {
    this.log('🔄 Удаление событий и ставок...');
    
    const eventsCount = await Event.countDocuments();
    const eventBetsCount = await EventBet.countDocuments();
    
    await Event.deleteMany({});
    await EventBet.deleteMany({});
    
    this.log(`✅ Удалено ${eventsCount} событий и ${eventBetsCount} ставок`);
  }

  async resetCasinoFinance() {
    this.log('🔄 Сброс финансов казино...');
    
    // Полностью пересоздаем запись casino-finance
    await CasinoFinance.deleteMany({});
    
    const newFinance = new CasinoFinance({
      totalUserBalance: 0,
      operationalBalance: 0,
      reserveBalance: 0,
      availableForWithdrawal: 0,
      reservePercentage: 30,
      totalBets: 0,
      totalWins: 0,
      totalCommissions: 0,
      commissionBreakdown: {
        duels: 0,
        events: 0
      },
      totalPromocodeExpenses: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalOwnerWithdrawals: 0,
      totalReferralPayments: 0,
      gameStats: {
        coin: { totalBets: 0, totalWins: 0, totalGames: 0, profit: 0 },
        mines: { totalBets: 0, totalWins: 0, totalGames: 0, profit: 0 },
        slots: { totalBets: 0, totalWins: 0, totalGames: 0, profit: 0 },
        crash: { totalBets: 0, totalWins: 0, totalGames: 0, profit: 0 },
        events: { totalBets: 0, totalWins: 0, totalGames: 0, profit: 0, totalEventBets: 0, totalPayouts: 0 }
      },
      balanceHistory: [],
      warnings: {
        lowReserve: false,
        highRiskRatio: false,
        negativeOperational: false
      },
      lastCalculated: new Date(),
      lastOwnerWithdrawal: null
    });
    
    await newFinance.save();
    
    this.log('✅ Финансы казино полностью сброшены');
  }

  async verifyReset() {
    this.log('🔍 Проверка результатов сброса...');
    
    const stats = {
      users: await User.countDocuments(),
      usersWithBalance: await User.countDocuments({ balance: { $gt: 0 } }),
      games: await Game.countDocuments(),
      transactions: await Transaction.countDocuments(),
      deposits: await Deposit.countDocuments(),
      withdrawals: await Withdrawal.countDocuments(),
      referralEarnings: await ReferralEarning.countDocuments(),
      referralPayouts: await ReferralPayout.countDocuments(),
      crashRounds: await CrashRound.countDocuments(),
      duels: await Duel.countDocuments(),
      events: await Event.countDocuments(),
      eventBets: await EventBet.countDocuments()
    };
    
    this.log('📊 Статистика после сброса:');
    this.log(`   Пользователи: ${stats.users} (с балансом: ${stats.usersWithBalance})`);
    this.log(`   Игры: ${stats.games}`);
    this.log(`   Транзакции: ${stats.transactions}`);
    this.log(`   Депозиты: ${stats.deposits}`);
    this.log(`   Выводы: ${stats.withdrawals}`);
    this.log(`   Реферальные начисления: ${stats.referralEarnings}`);
    this.log(`   Реферальные выплаты: ${stats.referralPayouts}`);
    this.log(`   Crash раунды: ${stats.crashRounds}`);
    this.log(`   Дуэли: ${stats.duels}`);
    this.log(`   События: ${stats.events}`);
    this.log(`   Ставки на события: ${stats.eventBets}`);
    
    // Проверяем финансы
    const finance = await CasinoFinance.findOne();
    this.log(`💰 Финансы казино:`);
    this.log(`   Баланс пользователей: ${finance.totalUserBalance} USDT`);
    this.log(`   Оперативный баланс: ${finance.operationalBalance} USDT`);
    this.log(`   Резерв: ${finance.reserveBalance} USDT`);
    
    return stats;
  }

  async performFullReset() {
    try {
      this.log('🚀 НАЧАЛО ПОЛНОГО СБРОСА ДАННЫХ');
      this.log('⚠️  Все тестовые данные будут удалены!');
      
      await this.connectDB();
      
      // Выполняем сброс в правильном порядке
      await this.resetGames();
      await this.resetTransactions();
      await this.resetDepositsWithdrawals();
      await this.resetReferralData();
      await this.resetPromocodes();
      await this.resetCrashData();
      await this.resetDuels();
      await this.resetEvents();
      await this.resetUsers();
      await this.resetCasinoFinance();
      
      // Проверяем результат
      const stats = await this.verifyReset();
      
      this.log('✅ ПОЛНЫЙ СБРОС ЗАВЕРШЕН УСПЕШНО');
      this.log('🎯 Система готова для работы с реальными деньгами');
      
      return {
        success: true,
        stats,
        log: this.resetLog
      };
      
    } catch (error) {
      this.log(`❌ Ошибка при сбросе: ${error.message}`);
      throw error;
    } finally {
      await mongoose.disconnect();
      this.log('🔌 Соединение с БД закрыто');
    }
  }
}

// Функция подтверждения
function askConfirmation() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n⚠️  ВНИМАНИЕ! ⚠️');
    console.log('Вы собираетесь удалить ВСЕ тестовые данные:');
    console.log('- Все игры и статистику');
    console.log('- Все транзакции');
    console.log('- Все депозиты и выводы');
    console.log('- Все реферальные данные');
    console.log('- Балансы всех пользователей');
    console.log('- Финансовую статистику казино');
    console.log('\nЭто действие НЕОБРАТИМО!\n');
    
    rl.question('Вы уверены? Введите "YES" для подтверждения: ', (answer) => {
      rl.close();
      resolve(answer === 'YES');
    });
  });
}

// Основная функция
async function main() {
  try {
    console.log('🎰 GREENLIGHT CASINO - СБРОС ТЕСТОВЫХ ДАННЫХ\n');
    
    const confirmed = await askConfirmation();
    
    if (!confirmed) {
      console.log('❌ Операция отменена пользователем');
      process.exit(0);
    }
    
    const resetService = new DataResetService();
    const result = await resetService.performFullReset();
    
    console.log('\n📝 ОТЧЕТ О СБРОСЕ:');
    result.log.forEach(logEntry => console.log(logEntry));
    
    console.log('\n🎉 Система готова к работе с реальными деньгами!');
    console.log('💡 Теперь можете пополнить реальный баланс для тестирования');
    
  } catch (error) {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error('\n🆘 Обратитесь к разработчику!');
    process.exit(1);
  }
}

// Экспортируем для использования как модуль
module.exports = DataResetService;

// Запускаем если вызван напрямую
if (require.main === module) {
  main();
}