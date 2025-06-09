#!/usr/bin/env node

/**
 * ДИАГНОСТИКА ЗАВИСШИХ ДУЭЛЕЙ
 * 
 * Находит проблемные дуэли и анализирует причины зависания
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Duel, DuelRound, User, Transaction } = require('./src/models');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('DUEL_DIAGNOSTICS');

class DuelDiagnostics {
  constructor() {
    this.findings = {
      timestamp: new Date(),
      stuckDuels: [],
      expiredDuels: [],
      lockedFundsIssues: [],
      incompleteRounds: [],
      statistics: {}
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
   * Находит зависшие дуэли
   */
  async findStuckDuels() {
    logger.info('🔍 Поиск зависших дуэлей...');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Дуэли в статусе active или pending дольше 30 минут
    const stuckDuels = await Duel.find({
      status: { $in: ['active', 'pending', 'waiting'] },
      createdAt: { $lt: thirtyMinutesAgo }
    }).populate('rounds');

    // Дуэли с истекшим временем ожидания
    const expiredDuels = await Duel.find({
      expiresAt: { $lt: now },
      status: { $in: ['pending', 'waiting'] }
    }).populate('rounds');

    logger.info(`   Найдено зависших дуэлей: ${stuckDuels.length}`);
    logger.info(`   Найдено просроченных дуэлей: ${expiredDuels.length}`);

    // Анализируем каждую зависшую дуэль
    for (const duel of stuckDuels) {
      const analysis = await this.analyzeDuel(duel);
      this.findings.stuckDuels.push(analysis);
    }

    for (const duel of expiredDuels) {
      const analysis = await this.analyzeDuel(duel);
      this.findings.expiredDuels.push(analysis);
    }

    return { stuckDuels, expiredDuels };
  }

  /**
   * Анализирует конкретную дуэль
   */
  async analyzeDuel(duel) {
    logger.info(`🔍 Анализ дуэли: ${duel.sessionId}`);

    // Получаем информацию об участниках
    const [challenger, opponent] = await Promise.all([
      User.findOne({ telegramId: duel.challengerId }),
      User.findOne({ telegramId: duel.opponentId })
    ]);

    // Получаем раунды дуэли
    const rounds = await DuelRound.find({ duelId: duel._id }).sort({ roundNumber: 1 });

    // Проверяем заблокированные средства
    const challengerLockedFunds = challenger?.lockedFunds?.filter(lf => 
      lf.reason === 'duel' && 
      lf.amount === duel.amount
    ) || [];

    const opponentLockedFunds = opponent?.lockedFunds?.filter(lf => 
      lf.reason === 'duel' && 
      lf.amount === duel.amount
    ) || [];

    // Проверяем транзакции
    const duelTransactions = await Transaction.find({
      $or: [
        { user: challenger?._id, description: { $regex: duel.sessionId } },
        { user: opponent?._id, description: { $regex: duel.sessionId } }
      ]
    });

    const analysis = {
      duelInfo: {
        sessionId: duel.sessionId,
        status: duel.status,
        gameType: duel.gameType,
        format: duel.format,
        amount: duel.amount,
        createdAt: duel.createdAt,
        startedAt: duel.startedAt,
        expiresAt: duel.expiresAt,
        age: Math.round((new Date() - duel.createdAt) / 60000) // минуты
      },
      participants: {
        challenger: {
          telegramId: duel.challengerId,
          username: duel.challengerUsername,
          found: !!challenger,
          balance: challenger?.balance,
          lockedFunds: challengerLockedFunds.length,
          lockedAmount: challengerLockedFunds.reduce((sum, lf) => sum + lf.amount, 0)
        },
        opponent: {
          telegramId: duel.opponentId,
          username: duel.opponentUsername,
          found: !!opponent,
          balance: opponent?.balance,
          lockedFunds: opponentLockedFunds.length,
          lockedAmount: opponentLockedFunds.reduce((sum, lf) => sum + lf.amount, 0)
        }
      },
      rounds: {
        total: rounds.length,
        completed: rounds.filter(r => r.status === 'completed').length,
        active: rounds.filter(r => r.status === 'active').length,
        pending: rounds.filter(r => r.status === 'pending').length,
        details: rounds.map(r => ({
          roundNumber: r.roundNumber,
          status: r.status,
          winnerId: r.winnerId,
          createdAt: r.createdAt,
          completedAt: r.completedAt
        }))
      },
      transactions: {
        total: duelTransactions.length,
        details: duelTransactions.map(t => ({
          user: t.user,
          type: t.type,
          amount: t.amount,
          status: t.status,
          description: t.description,
          createdAt: t.createdAt
        }))
      },
      problems: []
    };

    // Определяем проблемы
    if (!challenger) {
      analysis.problems.push('Challenger не найден в базе');
    }
    if (!opponent) {
      analysis.problems.push('Opponent не найден в базе');
    }
    if (duel.expiresAt && duel.expiresAt < new Date()) {
      analysis.problems.push('Дуэль просрочена');
    }
    if (analysis.rounds.total === 0 && duel.status === 'active') {
      analysis.problems.push('Нет раундов при активной дуэли');
    }
    if (analysis.rounds.active > 1) {
      analysis.problems.push('Несколько активных раундов одновременно');
    }
    if (challengerLockedFunds.length === 0 && duel.status !== 'completed') {
      analysis.problems.push('У challenger нет заблокированных средств');
    }
    if (opponentLockedFunds.length === 0 && duel.status === 'active') {
      analysis.problems.push('У opponent нет заблокированных средств');
    }
    if (analysis.duelInfo.age > 60) {
      analysis.problems.push(`Дуэль висит уже ${analysis.duelInfo.age} минут`);
    }

    // Проверяем логику раундов
    if (analysis.rounds.total > 0) {
      const lastRound = rounds[rounds.length - 1];
      if (lastRound.status === 'active' && 
          lastRound.createdAt < new Date(Date.now() - 10 * 60 * 1000)) {
        analysis.problems.push('Последний раунд завис более 10 минут назад');
      }
    }

    return analysis;
  }

  /**
   * Проверяет заблокированные средства пользователей
   */
  async checkLockedFunds() {
    logger.info('🔍 Проверка заблокированных средств...');

    const usersWithLockedFunds = await User.find({
      'lockedFunds.0': { $exists: true }
    });

    const now = new Date();
    const issues = [];

    for (const user of usersWithLockedFunds) {
      for (const lockedFund of user.lockedFunds) {
        if (lockedFund.reason === 'duel') {
          // Проверяем, существует ли дуэль
          const relatedDuel = await Duel.findOne({
            $or: [
              { challengerId: user.telegramId.toString() },
              { opponentId: user.telegramId.toString() }
            ],
            amount: lockedFund.amount,
            status: { $in: ['pending', 'active', 'waiting'] },
            createdAt: {
              $gte: new Date(lockedFund.lockedAt.getTime() - 60000),
              $lte: new Date(lockedFund.lockedAt.getTime() + 60000)
            }
          });

          if (!relatedDuel) {
            issues.push({
              userId: user._id,
              telegramId: user.telegramId,
              username: user.username,
              lockedAmount: lockedFund.amount,
              lockedAt: lockedFund.lockedAt,
              expiresAt: lockedFund.expiresAt,
              isExpired: lockedFund.expiresAt < now,
              problem: 'Заблокированные средства без соответствующей дуэли'
            });
          } else if (relatedDuel.status === 'completed') {
            issues.push({
              userId: user._id,
              telegramId: user.telegramId,
              username: user.username,
              lockedAmount: lockedFund.amount,
              lockedAt: lockedFund.lockedAt,
              duelId: relatedDuel._id,
              duelStatus: relatedDuel.status,
              problem: 'Средства заблокированы для завершенной дуэли'
            });
          }
        }
      }
    }

    this.findings.lockedFundsIssues = issues;
    logger.info(`   Найдено проблем с заблокированными средствами: ${issues.length}`);

    return issues;
  }

  /**
   * Собирает общую статистику дуэлей
   */
  async gatherStatistics() {
    logger.info('📊 Сбор статистики дуэлей...');

    const stats = await Duel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    const roundStats = await DuelRound.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Дуэли по возрасту
    const now = new Date();
    const ageStats = await Duel.aggregate([
      {
        $addFields: {
          ageMinutes: {
            $divide: [
              { $subtract: [now, '$createdAt'] },
              60000
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$ageMinutes',
          boundaries: [0, 30, 60, 180, 1440, Infinity],
          default: 'old',
          output: {
            count: { $sum: 1 },
            statuses: { $push: '$status' }
          }
        }
      }
    ]);

    this.findings.statistics = {
      byStatus: stats,
      roundsByStatus: roundStats,
      byAge: ageStats,
      totalDuels: await Duel.countDocuments(),
      totalRounds: await DuelRound.countDocuments()
    };

    logger.info(`   Всего дуэлей: ${this.findings.statistics.totalDuels}`);
    logger.info(`   Всего раундов: ${this.findings.statistics.totalRounds}`);

    return this.findings.statistics;
  }

  /**
   * Запускает полную диагностику
   */
  async runDiagnostics() {
    try {
      logger.info('🚀 НАЧАЛО ДИАГНОСТИКИ ДУЭЛЕЙ');
      
      await this.connectDB();

      // Выполняем все проверки
      await this.findStuckDuels();
      await this.checkLockedFunds();
      await this.gatherStatistics();

      logger.info('✅ ДИАГНОСТИКА ЗАВЕРШЕНА');
      
      return this.findings;

    } catch (error) {
      logger.error('❌ Ошибка при диагностике:', error);
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
    const findings = this.findings;
    
    console.log('\n');
    console.log('🩺'.repeat(40));
    console.log('           ДИАГНОСТИЧЕСКИЙ ОТЧЕТ ДУЭЛЕЙ');
    console.log('🩺'.repeat(40));
    console.log(`Время: ${findings.timestamp.toLocaleString()}`);
    console.log('');

    // Общая статистика
    console.log('📊 ОБЩАЯ СТАТИСТИКА:');
    console.log(`   Всего дуэлей: ${findings.statistics.totalDuels}`);
    console.log(`   Всего раундов: ${findings.statistics.totalRounds}`);
    
    if (findings.statistics.byStatus) {
      console.log('   По статусам:');
      findings.statistics.byStatus.forEach(stat => {
        console.log(`     ${stat._id}: ${stat.count} дуэлей (${stat.totalAmount.toFixed(2)} USDT)`);
      });
    }
    console.log('');

    // Зависшие дуэли
    console.log('🚨 ЗАВИСШИЕ ДУЭЛИ:');
    console.log(`   Найдено: ${findings.stuckDuels.length}`);
    
    findings.stuckDuels.forEach((duel, i) => {
      console.log(`   ${i + 1}. ${duel.duelInfo.sessionId}`);
      console.log(`      Статус: ${duel.duelInfo.status}, Возраст: ${duel.duelInfo.age} мин`);
      console.log(`      Участники: ${duel.participants.challenger.username} vs ${duel.participants.opponent.username}`);
      console.log(`      Раунды: ${duel.rounds.completed}/${duel.rounds.total} завершено`);
      console.log(`      Проблемы: ${duel.problems.join(', ') || 'Нет'}`);
      console.log('');
    });

    // Просроченные дуэли
    if (findings.expiredDuels.length > 0) {
      console.log('⏰ ПРОСРОЧЕННЫЕ ДУЭЛИ:');
      console.log(`   Найдено: ${findings.expiredDuels.length}`);
      
      findings.expiredDuels.forEach((duel, i) => {
        console.log(`   ${i + 1}. ${duel.duelInfo.sessionId} (просрочена на ${Math.round((new Date() - duel.duelInfo.expiresAt) / 60000)} мин)`);
      });
      console.log('');
    }

    // Проблемы с заблокированными средствами
    console.log('💰 ПРОБЛЕМЫ С ЗАБЛОКИРОВАННЫМИ СРЕДСТВАМИ:');
    console.log(`   Найдено: ${findings.lockedFundsIssues.length}`);
    
    findings.lockedFundsIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.username} (${issue.telegramId})`);
      console.log(`      Заблокировано: ${issue.lockedAmount} USDT`);
      console.log(`      Проблема: ${issue.problem}`);
      if (issue.isExpired) console.log(`      ⚠️ Блокировка истекла!`);
      console.log('');
    });

    console.log('🩺'.repeat(40));
    console.log('');
  }

  /**
   * Генерирует команды для исправления проблем
   */
  generateFixCommands() {
    const commands = [];
    
    // Команды для разблокировки просроченных средств
    this.findings.lockedFundsIssues.forEach(issue => {
      if (issue.isExpired) {
        commands.push({
          type: 'unlock_expired_funds',
          description: `Разблокировать просроченные средства пользователя ${issue.username}`,
          userId: issue.userId,
          amount: issue.lockedAmount
        });
      }
    });

    // Команды для завершения зависших дуэлей
    this.findings.stuckDuels.forEach(duel => {
      if (duel.duelInfo.age > 60) {
        commands.push({
          type: 'cancel_stuck_duel',
          description: `Отменить зависшую дуэль ${duel.duelInfo.sessionId}`,
          duelId: duel.duelInfo.sessionId,
          reason: `Дуэль зависла на ${duel.duelInfo.age} минут`
        });
      }
    });

    console.log('🔧 РЕКОМЕНДУЕМЫЕ ИСПРАВЛЕНИЯ:');
    commands.forEach((cmd, i) => {
      console.log(`   ${i + 1}. ${cmd.description}`);
    });
    console.log('');

    return commands;
  }
}

// Запуск диагностики
async function main() {
  const diagnostics = new DuelDiagnostics();
  
  try {
    const findings = await diagnostics.runDiagnostics();
    diagnostics.printDetailedReport();
    diagnostics.generateFixCommands();
    
    // Сохраняем результаты в файл
    const fs = require('fs');
    const filename = `duel_diagnostics_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(findings, null, 2));
    console.log(`🔍 Детальные результаты диагностики сохранены в ${filename}`);
    
  } catch (error) {
    console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ДИАГНОСТИКИ:', error);
    process.exit(1);
  }
}

// Экспортируем для использования как модуль
module.exports = DuelDiagnostics;

// Запускаем если вызван напрямую
if (require.main === module) {
  main();
}