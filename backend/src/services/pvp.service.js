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
   * @param {string} challengeData.gameType - Тип игры (эмодзи)
   * @param {string} challengeData.format - Формат серии (bo1, bo3, etc)
   * @param {number} challengeData.winsRequired - Побед для выигрыша
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
      gameType = '🎲',
      format = 'bo1',
      winsRequired = 1,
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
      gameType,
      format,
      winsRequired,
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
   * Сохранить результат раунда
   * @param {string} sessionId
   * @param {Object} roundData
   * @returns {Promise<Object>}
   */
  async saveRound(sessionId, roundData) {
    const duel = await PvPDuel.findBySession(sessionId);
    
    if (!duel) {
      throw new Error('Сессия не найдена');
    }
    
    if (duel.status !== 'active') {
      throw new Error('Дуэль не активна');
    }
    
    // Добавляем раунд
    duel.rounds.push({
      number: roundData.round,
      challengerResult: roundData.challengerResult,
      opponentResult: roundData.opponentResult,
      winnerId: roundData.winnerId
    });
    
    // Обновляем счет
    if (roundData.winnerId === duel.challengerId) {
      duel.score.challenger++;
    } else {
      duel.score.opponent++;
    }
    
    await duel.save();
    
    return {
      success: true,
      data: {
        score: duel.score,
        rounds: duel.rounds.length,
        winsRequired: duel.winsRequired
      }
    };
  }

  /**
   * Завершить дуэль с победителем
   * @param {string} sessionId
   * @param {string} winnerId
   * @returns {Promise<Object>}
   */
  async finishDuel(sessionId, winnerId) {
    const duel = await PvPDuel.findBySession(sessionId);
    
    if (!duel) {
      throw new Error('Сессия не найдена');
    }
    
    // Устанавливаем победителя
    duel.winnerId = winnerId;
    duel.winnerUsername = winnerId === duel.challengerId ? duel.challengerUsername : duel.opponentUsername;
    duel.loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
    duel.loserUsername = winnerId === duel.challengerId ? duel.opponentUsername : duel.challengerUsername;
    duel.status = 'completed';
    duel.completedAt = new Date();
    
    await duel.save();
    
    // Обрабатываем выплаты
    await this.processPayouts(duel);
    
    // Создаем записи в истории игр для обоих игроков
    await this.createGameHistoryRecords(duel, session);
    
    // Обновляем финансовую статистику казино
    await this.updateCasinoFinances(duel);
    
    return {
      success: true,
      data: {
        winnerId: duel.winnerId,
        winnerUsername: duel.winnerUsername,
        loserId: duel.loserId,
        loserUsername: duel.loserUsername,
        winAmount: duel.winAmount,
        finalScore: duel.score
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
    
    // Создаем записи в истории игр для обоих игроков
    await this.createGameHistoryRecords(duel, session);
    
    // Обновляем финансовую статистику казино
    await this.updateCasinoFinances(duel);

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
   * Обработать реферальные выплаты (процент с комиссии казино)
   * @param {Object} duel
   * @param {Object} session
   */
  async processReferralPayouts(duel, session) {
    // В PvP реферальная выплата берется из комиссии казино
    // Используем заявленные проценты реферальной системы
    
    const loserId = duel.loserId;
    const loserReferrerId = loserId === duel.challengerId ? duel.challengerReferrerId : duel.opponentReferrerId;
    
    if (!loserReferrerId) {
      console.log('PvP: У проигравшего игрока нет реферера');
      return;
    }

    // Получаем реферера проигравшего
    const referrer = await User.findOne({ telegramId: loserReferrerId }).session(session);
    if (!referrer) {
      console.log('PvP: Реферер проигравшего не найден');
      return;
    }

    // Используем заявленный процент реферера (5-15% в зависимости от уровня)
    const commission = duel.commission; // 5% от общего банка
    const commissionPercent = referrer.referralStats?.commissionPercent || 5; // По умолчанию 5% (бронза)
    const referralAmount = commission * (commissionPercent / 100);

    // Начисляем реферальную комиссию
    await this.payReferral(loserReferrerId, referralAmount, duel, 'pvp_loss', session);
    
    duel.referralPayouts.push({
      userId: loserReferrerId,
      amount: referralAmount,
      type: 'loser_referral',
      commissionPercent: commissionPercent,
      baseAmount: commission,
      source: 'casino_commission' // Указываем, что выплата из комиссии
    });

    console.log(`PvP реферальная комиссия: ${referralAmount.toFixed(4)} USDT (${commissionPercent}% с комиссии ${commission} USDT) для реферера ${loserReferrerId}`);
  }

  /**
   * Выплатить реферальную комиссию через основную реферальную систему
   * @param {string} referrerId
   * @param {number} amount
   * @param {Object} duel
   * @param {string} type
   * @param {Object} session
   */
  async payReferral(referrerId, amount, duel, type, session) {
    try {
      // Находим реферера по telegramId
      const referrer = await User.findOne({ telegramId: referrerId }).session(session);
      if (!referrer) {
        console.log(`PvP: Реферер ${referrerId} не найден`);
        return;
      }

      // Начисляем на реферальный баланс (как в основной системе)
      referrer.referralStats.referralBalance += amount;
      referrer.referralStats.totalEarned += amount;
      await referrer.save({ session });

      // Создаем запись о реферальном доходе через основную модель
      await ReferralEarning.create([{
        partner: referrer._id,
        referral: duel.loserId === duel.challengerId ? 
          await User.findOne({ telegramId: duel.challengerId }).select('_id').session(session) :
          await User.findOne({ telegramId: duel.opponentId }).select('_id').session(session),
        game: null, // PvP не имеет game ID
        type: 'pvp_commission',
        calculation: {
          baseAmount: duel.commission, // База расчета - комиссия казино
          partnerLevel: referrer.referralStats.level,
          commissionPercent: referrer.referralStats.commissionPercent,
          earnedAmount: amount
        },
        status: 'credited',
        balanceBefore: referrer.referralStats.referralBalance - amount,
        balanceAfter: referrer.referralStats.referralBalance,
        metadata: {
          source: 'pvp',
          duelId: duel._id.toString(),
          sessionId: duel.sessionId,
          gameType: duel.gameType || 'coin',
          format: duel.format || 'bo1',
          lossAmount: duel.amount, // Также указываем сумму проигрыша для справки
          payout_source: 'casino_commission' // Источник - комиссия казино
        },
        creditedAt: new Date()
      }], { session });

      console.log(`PvP: Начислено ${amount.toFixed(4)} USDT на реферальный баланс партнера ${referrer._id}`);

    } catch (error) {
      console.error('PvP: Ошибка начисления реферальной комиссии:', error);
      // Не прерываем транзакцию из-за ошибки реферальных выплат
    }
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

  /**
   * Создает записи в истории игр для обоих участников PvP дуэли
   * @param {Object} duel - Объект дуэли
   * @param {Object} session - MongoDB сессия
   */
  async createGameHistoryRecords(duel, session) {
    try {
      const { Game, User } = require('../models');
      
      // Получаем объекты пользователей
      const challenger = await User.findOne({ telegramId: duel.challengerId }).session(session);
      const opponent = await User.findOne({ telegramId: duel.opponentId }).session(session);
      
      if (!challenger || !opponent) {
        console.log('PvP: Не удалось найти пользователей для создания игровых записей');
        return;
      }

      // Определяем результат для каждого игрока
      const challengerWon = duel.winnerId === duel.challengerId;
      const opponentWon = duel.winnerId === duel.opponentId;

      // Создаем результат дуэли
      const duelResult = {
        duelId: duel._id,
        sessionId: duel.sessionId,
        gameType: duel.gameType || 'coin',
        format: duel.format || 'bo1',
        score: duel.score,
        rounds: duel.rounds,
        opponent: {
          challengerId: duel.challengerId,
          challengerUsername: duel.challengerUsername,
          opponentId: duel.opponentId, 
          opponentUsername: duel.opponentUsername
        },
        totalBank: duel.totalBank,
        commission: duel.commission
      };

      // Запись для challenger
      const challengerGame = new Game({
        user: challenger._id,
        gameType: 'pvp',
        bet: duel.amount,
        multiplier: challengerWon ? (duel.winAmount / duel.amount) : 0,
        result: {
          ...duelResult,
          playerRole: 'challenger',
          opponentUsername: duel.opponentUsername
        },
        win: challengerWon,
        profit: challengerWon ? (duel.winAmount - duel.amount) : -duel.amount,
        balanceBefore: challenger.balance - (challengerWon ? (duel.winAmount - duel.amount) : -duel.amount),
        balanceAfter: challenger.balance,
        clientSeed: `pvp_${duel.sessionId}_challenger`,
        serverSeed: duel.gameData?.serverSeed || `pvp_server_${duel.sessionId}`,
        nonce: 1,
        metadata: {
          pvpDuel: true,
          opponentId: duel.opponentId,
          format: duel.format,
          finalScore: `${duel.score.challenger}-${duel.score.opponent}`
        }
      });

      // Запись для opponent  
      const opponentGame = new Game({
        user: opponent._id,
        gameType: 'pvp',
        bet: duel.amount,
        multiplier: opponentWon ? (duel.winAmount / duel.amount) : 0,
        result: {
          ...duelResult,
          playerRole: 'opponent',
          opponentUsername: duel.challengerUsername
        },
        win: opponentWon,
        profit: opponentWon ? (duel.winAmount - duel.amount) : -duel.amount,
        balanceBefore: opponent.balance - (opponentWon ? (duel.winAmount - duel.amount) : -duel.amount),
        balanceAfter: opponent.balance,
        clientSeed: `pvp_${duel.sessionId}_opponent`,
        serverSeed: duel.gameData?.serverSeed || `pvp_server_${duel.sessionId}`,
        nonce: 2,
        metadata: {
          pvpDuel: true,
          opponentId: duel.challengerId,
          format: duel.format,
          finalScore: `${duel.score.opponent}-${duel.score.challenger}`
        }
      });

      // Сохраняем обе записи
      await Game.create([challengerGame, opponentGame], { session });

      console.log(`PvP: Созданы игровые записи для дуэли ${duel.sessionId}`);
      
    } catch (error) {
      console.error('PvP: Ошибка создания игровых записей:', error);
      // Не прерываем основную транзакцию из-за ошибки истории
    }
  }

  /**
   * Обновляет финансовую статистику казино после PvP дуэли
   * @param {Object} duel - Объект дуэли
   */
  async updateCasinoFinances(duel) {
    try {
      const casinoFinanceService = require('./casino-finance.service');
      
      // Обновляем статистику по каждому игроку как отдельную игру
      const totalBets = duel.amount * 2; // Общая сумма ставок
      const totalWins = duel.winAmount; // Выигрыш победителя
      const commission = duel.commission; // Комиссия казино
      
      // Рассчитываем реферальные выплаты
      const referralPayouts = duel.referralPayouts || [];
      const totalReferralPayouts = referralPayouts.reduce((sum, payout) => sum + payout.amount, 0);
      
      // Обновляем через casino finance service
      await casinoFinanceService.updateAfterGame({
        gameType: 'pvp',
        bet: totalBets,
        profit: commission - totalReferralPayouts, // Прибыль казино после реферальных выплат
        win: false, // PvP всегда приносит прибыль казино
        metadata: {
          duelId: duel._id,
          sessionId: duel.sessionId,
          commission: commission,
          referralPayouts: totalReferralPayouts,
          gameFormat: duel.format
        }
      });
      
      console.log(`PvP: Обновлена финансовая статистика - ставки: ${totalBets}, комиссия: ${commission}, реферальные: ${totalReferralPayouts}`);
      
    } catch (error) {
      console.error('PvP: Ошибка обновления финансовой статистики:', error);
      // Не прерываем основную логику
    }
  }
}

module.exports = new PvPService();