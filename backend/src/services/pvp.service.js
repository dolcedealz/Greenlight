// backend/src/services/pvp.service.js
const mongoose = require('mongoose');
const { PvPDuel, User, Transaction, ReferralEarning } = require('../models');
const { userService, referralService } = require('./');
const crypto = require('crypto');

class PvPService {
  constructor() {
    this.activeSessions = new Map(); // Кэш активных сессий
  }

  /**
   * Создать вызов на дуэль
   * @param {Object} challengeData
   * @param {string} challengeData.challengerId - ID инициатора
   * @param {string} challengeData.challengerUsername - Username инициатора
   * @param {string} challengeData.opponentId - ID оппонента
   * @param {string} challengeData.opponentUsername - Username оппонента
   * @param {number} challengeData.amount - Размер ставки
   * @param {string} challengeData.chatId - ID чата
   * @param {string} challengeData.chatType - Тип чата
   * @param {number} challengeData.messageId - ID сообщения
   * @returns {Promise<Object>}
   */
  async createChallenge(challengeData) {
    const {
      challengerId,
      challengerUsername,
      opponentId,
      opponentUsername,
      amount,
      chatId,
      chatType,
      messageId
    } = challengeData;

    // Валидация
    await this.validateChallenge(challengerId, opponentId, amount);

    // Проверяем реферальную связь
    const challengerUser = await User.findOne({ telegramId: challengerId });
    const opponentUser = await User.findOne({ telegramId: opponentId });

    if (!challengerUser || !opponentUser) {
      throw new Error('Один из игроков не найден');
    }

    // Создаем дуэль
    const duel = new PvPDuel({
      challengerId,
      challengerUsername,
      opponentId,
      opponentUsername,
      amount,
      chatId,
      chatType: chatType || 'private',
      messageId,
      challengerReferrerId: challengerUser.referrerId,
      opponentReferrerId: opponentUser.referrerId
    });

    await duel.save();

    return {
      success: true,
      data: {
        duelId: duel._id,
        challengerId: duel.challengerId,
        challengerUsername: duel.challengerUsername,
        opponentId: duel.opponentId,
        opponentUsername: duel.opponentUsername,
        amount: duel.amount,
        totalBank: duel.totalBank,
        commission: duel.commission,
        winAmount: duel.winAmount,
        expiresAt: duel.expiresAt,
        status: duel.status
      }
    };
  }

  /**
   * Валидировать возможность создания вызова
   * @param {string} challengerId
   * @param {string} opponentId
   * @param {number} amount
   */
  async validateChallenge(challengerId, opponentId, amount) {
    // Проверка лимитов суммы
    if (amount < 1 || amount > 1000) {
      throw new Error('Сумма ставки должна быть от 1 до 1000 USDT');
    }

    // Проверка, что игрок не вызывает сам себя
    if (challengerId === opponentId) {
      throw new Error('Нельзя вызвать самого себя на дуэль');
    }

    // Проверка балансов
    const challenger = await User.findOne({ telegramId: challengerId });
    const opponent = await User.findOne({ telegramId: opponentId });

    if (!challenger || !opponent) {
      throw new Error('Один из игроков не найден');
    }

    if (challenger.balance < amount) {
      throw new Error('Недостаточно средств для создания дуэли');
    }

    if (opponent.balance < amount) {
      throw new Error('У оппонента недостаточно средств для дуэли');
    }

    // Проверка лимита активных дуэлей (максимум 3)
    const activeDuels = await PvPDuel.findActiveByUser(challengerId);
    if (activeDuels.length >= 3) {
      throw new Error('Максимум 3 активных дуэли одновременно');
    }

    // Проверка кулдауна (30 секунд между вызовами)
    const recentChallenge = await PvPDuel.findOne({
      challengerId,
      createdAt: { $gt: new Date(Date.now() - 30000) }
    });

    if (recentChallenge) {
      throw new Error('Слишком частые вызовы. Подождите 30 секунд');
    }

    // Проверка, нет ли уже активной дуэли между этими игроками
    const existingDuel = await PvPDuel.findOne({
      $or: [
        { challengerId, opponentId },
        { challengerId: opponentId, opponentId: challengerId }
      ],
      status: { $in: ['pending', 'accepted', 'active'] }
    });

    if (existingDuel) {
      throw new Error('У вас уже есть активная дуэль с этим игроком');
    }
  }

  /**
   * Ответить на вызов (принять или отклонить)
   * @param {string} duelId
   * @param {string} userId
   * @param {string} action - 'accept' или 'decline'
   * @returns {Promise<Object>}
   */
  async respondToChallenge(duelId, userId, action) {
    const duel = await PvPDuel.findById(duelId);
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }

    if (duel.opponentId !== userId) {
      throw new Error('Только оппонент может ответить на вызов');
    }

    if (duel.status !== 'pending') {
      throw new Error('Дуэль уже не ожидает ответа');
    }

    if (duel.isExpired) {
      await duel.expire();
      throw new Error('Время ожидания истекло');
    }

    if (action === 'decline') {
      await duel.decline();
      return {
        success: true,
        data: {
          duelId: duel._id,
          status: 'declined',
          message: 'Дуэль отклонена'
        }
      };
    }

    if (action === 'accept') {
      // Проверяем балансы еще раз
      await this.validateChallenge(duel.challengerId, duel.opponentId, duel.amount);

      await duel.accept();

      return {
        success: true,
        data: {
          duelId: duel._id,
          sessionId: duel.sessionId,
          status: 'accepted',
          message: 'Дуэль принята! Войдите в игровую комнату'
        }
      };
    }

    throw new Error('Неверное действие');
  }

  /**
   * Присоединиться к игровой сессии
   * @param {string} sessionId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async joinSession(sessionId, userId) {
    const duel = await PvPDuel.findBySession(sessionId);
    
    if (!duel) {
      throw new Error('Сессия не найдена');
    }

    if (!duel.participants.includes(userId)) {
      throw new Error('Вы не участвуете в этой дуэли');
    }

    if (duel.status !== 'accepted') {
      throw new Error('Дуэль не готова к игре');
    }

    await duel.setPlayerJoined(userId, true);

    // Если оба присоединились, возвращаем полную информацию
    const updatedDuel = await PvPDuel.findBySession(sessionId);
    
    return {
      success: true,
      data: {
        sessionId: updatedDuel.sessionId,
        challengerId: updatedDuel.challengerId,
        challengerUsername: updatedDuel.challengerUsername,
        challengerJoined: updatedDuel.challengerJoined,
        challengerReady: updatedDuel.challengerReady,
        opponentId: updatedDuel.opponentId,
        opponentUsername: updatedDuel.opponentUsername,
        opponentJoined: updatedDuel.opponentJoined,
        opponentReady: updatedDuel.opponentReady,
        amount: updatedDuel.amount,
        winAmount: updatedDuel.winAmount,
        status: updatedDuel.status,
        bothJoined: updatedDuel.bothJoined
      }
    };
  }

  /**
   * Установить готовность игрока
   * @param {string} sessionId
   * @param {string} userId
   * @param {boolean} ready
   * @returns {Promise<Object>}
   */
  async setReady(sessionId, userId, ready = true) {
    const duel = await PvPDuel.findBySession(sessionId);
    
    if (!duel) {
      throw new Error('Сессия не найдена');
    }

    if (!duel.participants.includes(userId)) {
      throw new Error('Вы не участвуете в этой дуэли');
    }

    if (duel.status !== 'accepted') {
      throw new Error('Дуэль не готова к игре');
    }

    await duel.setPlayerReady(userId, ready);
    const updatedDuel = await PvPDuel.findBySession(sessionId);

    return {
      success: true,
      data: {
        sessionId: updatedDuel.sessionId,
        challengerReady: updatedDuel.challengerReady,
        opponentReady: updatedDuel.opponentReady,
        bothReady: updatedDuel.bothReady,
        canStart: updatedDuel.bothJoined && updatedDuel.bothReady
      }
    };
  }

  /**
   * Запустить игру
   * @param {string} sessionId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async startGame(sessionId, userId) {
    const duel = await PvPDuel.findBySession(sessionId);
    
    if (!duel) {
      throw new Error('Сессия не найдена');
    }

    if (!duel.participants.includes(userId)) {
      throw new Error('Вы не участвуете в этой дуэли');
    }

    if (duel.status !== 'accepted') {
      throw new Error('Дуэль не готова к запуску');
    }

    if (!duel.bothJoined || !duel.bothReady) {
      throw new Error('Оба игрока должны присоединиться и быть готовыми');
    }

    // Резервируем средства у обоих игроков
    await this.reserveFunds(duel);

    // Запускаем игру
    await duel.start();

    // НОВОЕ: Используем тот же механизм генерации, что и в обычной монетке
    const randomService = require('./random.service');
    const serverSeed = randomService.generateServerSeed();
    const clientSeed = `pvp_${sessionId}`;
    const nonce = 1;
    
    // Генерируем результат честно
    const randomValue = randomService.generateRandomNumber(serverSeed, clientSeed, nonce);
    const result = randomValue < 0.5 ? 'heads' : 'tails';
    
    // Сохраняем данные для верификации
    duel.gameData = {
      serverSeed,
      serverSeedHashed: randomService.hashServerSeed(serverSeed),
      clientSeed,
      nonce,
      randomValue
    };
    
    // Сохраняем gameData в базе
    await duel.save();

    // Завершаем игру
    await duel.complete(result);

    // Обрабатываем выплаты
    await this.processPayouts(duel);

    return {
      success: true,
      data: {
        sessionId: duel.sessionId,
        result: duel.coinResult,
        winnerId: duel.winnerId,
        winnerUsername: duel.winnerUsername,
        loserId: duel.loserId,
        loserUsername: duel.loserUsername,
        winAmount: duel.winAmount,
        commission: duel.commission,
        challengerSide: duel.challengerSide,
        opponentSide: duel.opponentSide,
        serverSeedHashed: duel.gameData.serverSeedHashed,
        status: 'completed'
      }
    };
  }


  /**
   * Резервировать средства у игроков
   * @param {Object} duel
   */
  async reserveFunds(duel) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Списываем средства у обоих игроков
      const challenger = await User.findOneAndUpdate(
        { 
          telegramId: duel.challengerId,
          balance: { $gte: duel.amount }
        },
        { $inc: { balance: -duel.amount } },
        { new: true, session }
      );

      if (!challenger) {
        throw new Error('Недостаточно средств у инициатора');
      }

      const opponent = await User.findOneAndUpdate(
        { 
          telegramId: duel.opponentId,
          balance: { $gte: duel.amount }
        },
        { $inc: { balance: -duel.amount } },
        { new: true, session }
      );

      if (!opponent) {
        throw new Error('Недостаточно средств у оппонента');
      }

      // Создаем транзакции
      await Transaction.create([
        {
          userId: duel.challengerId,
          type: 'pvp_bet',
          amount: -duel.amount,
          description: `PvP дуэль против ${duel.opponentUsername}`,
          balanceAfter: challenger.balance,
          metadata: {
            duelId: duel._id,
            sessionId: duel.sessionId,
            opponentId: duel.opponentId
          }
        },
        {
          userId: duel.opponentId,
          type: 'pvp_bet',
          amount: -duel.amount,
          description: `PvP дуэль против ${duel.challengerUsername}`,
          balanceAfter: opponent.balance,
          metadata: {
            duelId: duel._id,
            sessionId: duel.sessionId,
            opponentId: duel.challengerId
          }
        }
      ], { session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Обработать выплаты после игры
   * @param {Object} duel
   */
  async processPayouts(duel) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Выплачиваем выигрыш победителю
      const winner = await User.findOneAndUpdate(
        { telegramId: duel.winnerId },
        { $inc: { balance: duel.winAmount } },
        { new: true, session }
      );

      // Создаем транзакцию выигрыша
      await Transaction.create([{
        userId: duel.winnerId,
        type: 'pvp_win',
        amount: duel.winAmount,
        description: `Выигрыш в PvP дуэли против ${duel.loserId === duel.challengerId ? duel.challengerUsername : duel.opponentUsername}`,
        balanceAfter: winner.balance,
        metadata: {
          duelId: duel._id,
          sessionId: duel.sessionId,
          opponentId: duel.loserId
        }
      }], { session });

      // Обрабатываем реферальные выплаты
      await this.processReferralPayouts(duel, session);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Обработать реферальные выплаты
   * @param {Object} duel
   * @param {Object} session
   */
  async processReferralPayouts(duel, session) {
    const commission = duel.commission;
    let distributedAmount = 0;

    // 20% от комиссии рефереру победителя
    if (duel.winnerId === duel.challengerId && duel.challengerReferrerId) {
      const winnerReferralAmount = commission * 0.2;
      await this.payReferral(duel.challengerReferrerId, winnerReferralAmount, duel, 'winner_referral', session);
      distributedAmount += winnerReferralAmount;
      
      duel.referralPayouts.push({
        userId: duel.challengerReferrerId,
        amount: winnerReferralAmount,
        type: 'winner_referral'
      });
    } else if (duel.winnerId === duel.opponentId && duel.opponentReferrerId) {
      const winnerReferralAmount = commission * 0.2;
      await this.payReferral(duel.opponentReferrerId, winnerReferralAmount, duel, 'winner_referral', session);
      distributedAmount += winnerReferralAmount;
      
      duel.referralPayouts.push({
        userId: duel.opponentReferrerId,
        amount: winnerReferralAmount,
        type: 'winner_referral'
      });
    }

    // 10% от комиссии рефереру проигравшего
    if (duel.loserId === duel.challengerId && duel.challengerReferrerId) {
      const loserReferralAmount = commission * 0.1;
      await this.payReferral(duel.challengerReferrerId, loserReferralAmount, duel, 'loser_referral', session);
      distributedAmount += loserReferralAmount;
      
      duel.referralPayouts.push({
        userId: duel.challengerReferrerId,
        amount: loserReferralAmount,
        type: 'loser_referral'
      });
    } else if (duel.loserId === duel.opponentId && duel.opponentReferrerId) {
      const loserReferralAmount = commission * 0.1;
      await this.payReferral(duel.opponentReferrerId, loserReferralAmount, duel, 'loser_referral', session);
      distributedAmount += loserReferralAmount;
      
      duel.referralPayouts.push({
        userId: duel.opponentReferrerId,
        amount: loserReferralAmount,
        type: 'loser_referral'
      });
    }

    // Оставшиеся 70% идут казино (автоматически)
    const casinoAmount = commission - distributedAmount;
    console.log(`PvP комиссия: ${commission}, Реферальные: ${distributedAmount}, Казино: ${casinoAmount}`);
  }

  /**
   * Выплатить реферальную комиссию
   * @param {string} referrerId
   * @param {number} amount
   * @param {Object} duel
   * @param {string} type
   * @param {Object} session
   */
  async payReferral(referrerId, amount, duel, type, session) {
    // Начисляем реферальную комиссию
    await User.findOneAndUpdate(
      { telegramId: referrerId },
      { $inc: { balance: amount } },
      { session }
    );

    // Создаем запись о реферальном доходе
    await ReferralEarning.create([{
      referrerId,
      amount,
      source: 'pvp',
      sourceId: duel._id.toString(),
      metadata: {
        duelId: duel._id,
        sessionId: duel.sessionId,
        type: type,
        winnerId: duel.winnerId,
        loserId: duel.loserId
      }
    }], { session });

    // Создаем транзакцию
    const referrer = await User.findOne({ telegramId: referrerId }).session(session);
    await Transaction.create([{
      userId: referrerId,
      type: 'referral_earning',
      amount,
      description: `Реферальная комиссия с PvP дуэли (${type})`,
      balanceAfter: referrer.balance,
      metadata: {
        source: 'pvp',
        duelId: duel._id,
        sessionId: duel.sessionId
      }
    }], { session });
  }

  /**
   * Получить активные дуэли пользователя
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getActiveDuels(userId) {
    const duels = await PvPDuel.findActiveByUser(userId);
    
    return {
      success: true,
      data: duels.map(duel => ({
        duelId: duel._id,
        challengerId: duel.challengerId,
        challengerUsername: duel.challengerUsername,
        opponentId: duel.opponentId,
        opponentUsername: duel.opponentUsername,
        amount: duel.amount,
        status: duel.status,
        sessionId: duel.sessionId,
        createdAt: duel.createdAt,
        expiresAt: duel.expiresAt,
        isChallenger: duel.challengerId === userId
      }))
    };
  }

  /**
   * Получить историю PvP игр пользователя
   * @param {string} userId
   * @param {number} limit
   * @returns {Promise<Object>}
   */
  async getHistory(userId, limit = 20) {
    const history = await PvPDuel.findHistoryByUser(userId, limit);
    
    return {
      success: true,
      data: history.map(duel => ({
        duelId: duel._id,
        challengerId: duel.challengerId,
        challengerUsername: duel.challengerUsername,
        opponentId: duel.opponentId,
        opponentUsername: duel.opponentUsername,
        amount: duel.amount,
        winAmount: duel.winAmount,
        commission: duel.commission,
        status: duel.status,
        coinResult: duel.coinResult,
        winnerId: duel.winnerId,
        winnerUsername: duel.winnerUsername,
        isWinner: duel.winnerId === userId,
        createdAt: duel.createdAt,
        completedAt: duel.completedAt
      }))
    };
  }

  /**
   * Получить статистику PvP игр пользователя
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getStats(userId) {
    const stats = await PvPDuel.getUserStats(userId);
    
    if (stats.length === 0) {
      return {
        success: true,
        data: {
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalWinnings: 0,
          totalLosses: 0,
          netProfit: 0
        }
      };
    }

    return {
      success: true,
      data: stats[0]
    };
  }

  /**
   * Отменить свой вызов
   * @param {string} duelId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async cancelChallenge(duelId, userId) {
    const duel = await PvPDuel.findById(duelId);
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }

    if (duel.challengerId !== userId) {
      throw new Error('Только инициатор может отменить вызов');
    }

    if (duel.status !== 'pending') {
      throw new Error('Можно отменить только ожидающие вызовы');
    }

    await duel.cancel();

    return {
      success: true,
      data: {
        duelId: duel._id,
        status: 'cancelled',
        message: 'Вызов отменен'
      }
    };
  }

  /**
   * Создать реванш
   * @param {string} originalDuelId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async createRematch(originalDuelId, userId) {
    const originalDuel = await PvPDuel.findById(originalDuelId);
    
    if (!originalDuel) {
      throw new Error('Оригинальная дуэль не найдена');
    }

    if (!originalDuel.participants.includes(userId)) {
      throw new Error('Вы не участвовали в этой дуэли');
    }

    if (originalDuel.status !== 'completed') {
      throw new Error('Можно создать реванш только для завершенных дуэлей');
    }

    // Определяем нового инициатора и оппонента (меняем местами)
    const isOriginalChallenger = originalDuel.challengerId === userId;
    const newChallengerId = userId;
    const newChallengerUsername = isOriginalChallenger ? originalDuel.challengerUsername : originalDuel.opponentUsername;
    const newOpponentId = isOriginalChallenger ? originalDuel.opponentId : originalDuel.challengerId;
    const newOpponentUsername = isOriginalChallenger ? originalDuel.opponentUsername : originalDuel.challengerUsername;

    // Создаем новый вызов
    return await this.createChallenge({
      challengerId: newChallengerId,
      challengerUsername: newChallengerUsername,
      opponentId: newOpponentId,
      opponentUsername: newOpponentUsername,
      amount: originalDuel.amount,
      chatId: originalDuel.chatId,
      chatType: originalDuel.chatType,
      messageId: 0 // Будет установлено ботом
    });
  }

  /**
   * Очистить истекшие дуэли
   * @returns {Promise<number>}
   */
  async cleanupExpired() {
    return await PvPDuel.cleanupExpired();
  }

  /**
   * Получить сессию по ID
   * @param {string} sessionId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getSession(sessionId, userId) {
    const duel = await PvPDuel.findBySession(sessionId);
    
    if (!duel) {
      throw new Error('Сессия не найдена');
    }

    if (!duel.participants.includes(userId)) {
      throw new Error('Вы не участвуете в этой дуэли');
    }

    return {
      success: true,
      data: {
        sessionId: duel.sessionId,
        challengerId: duel.challengerId,
        challengerUsername: duel.challengerUsername,
        challengerJoined: duel.challengerJoined,
        challengerReady: duel.challengerReady,
        challengerSide: duel.challengerSide,
        opponentId: duel.opponentId,
        opponentUsername: duel.opponentUsername,
        opponentJoined: duel.opponentJoined,
        opponentReady: duel.opponentReady,
        opponentSide: duel.opponentSide,
        amount: duel.amount,
        winAmount: duel.winAmount,
        commission: duel.commission,
        status: duel.status,
        bothJoined: duel.bothJoined,
        bothReady: duel.bothReady,
        coinResult: duel.coinResult,
        winnerId: duel.winnerId,
        winnerUsername: duel.winnerUsername,
        isPlayer: duel.participants.includes(userId),
        isChallenger: duel.challengerId === userId
      }
    };
  }
}

module.exports = new PvPService();