const { Duel, DuelRound, DuelInvitation, User, Transaction } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

class DuelService {
  
  // Создание приглашения на дуэль (для inline режима)
  async createInvitation(data) {
    const { challengerId, challengerUsername, targetUsername, gameType, format, amount, metadata } = data;
    
    // Валидация
    await this.validateDuelParameters(challengerId, amount, gameType, format);
    
    // Проверяем лимиты пользователя
    await this.checkUserLimits(challengerId);
    
    // Создаем приглашение
    const invitation = await DuelInvitation.create({
      challengerId,
      challengerUsername,
      targetUsername,
      gameType,
      format,
      amount,
      metadata
    });
    
    return invitation;
  }
  
  // Принятие приглашения и создание дуэли
  async acceptInvitation(inviteId, acceptorId, acceptorUsername) {
    const transaction = await sequelize.transaction();
    
    try {
      // Находим приглашение
      const invitation = await DuelInvitation.findOne({
        where: { inviteId, status: 'pending' }
      });
      
      if (!invitation) {
        throw new Error('Приглашение не найдено или уже недействительно');
      }
      
      if (!invitation.canAccept(acceptorId, acceptorUsername)) {
        throw new Error('Вы не можете принять это приглашение');
      }
      
      // Валидация участников
      await this.validateDuelParameters(acceptorId, invitation.amount);
      
      // Блокируем средства у обоих игроков
      await this.lockUserFunds(invitation.challengerId, invitation.amount, transaction);
      await this.lockUserFunds(acceptorId, invitation.amount, transaction);
      
      // Создаем дуэль
      const duel = await Duel.create({
        challengerId: invitation.challengerId,
        challengerUsername: invitation.challengerUsername,
        opponentId: acceptorId,
        opponentUsername: acceptorUsername,
        gameType: invitation.gameType,
        format: invitation.format,
        amount: invitation.amount,
        status: 'accepted',
        chatId: '0', // Будет обновлено при старте
        chatType: 'private'
      }, { transaction });
      
      // Обновляем приглашение
      await invitation.update({
        status: 'accepted',
        targetUserId: acceptorId,
        duelId: duel.id
      }, { transaction });
      
      await transaction.commit();
      
      return { duel, invitation };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // Создание дуэли напрямую (для групповых чатов)
  async createDuel(data) {
    const { 
      challengerId, challengerUsername, 
      opponentId, opponentUsername,
      gameType, format, amount, 
      chatId, chatType, messageId 
    } = data;
    
    const transaction = await sequelize.transaction();
    
    try {
      // Валидация
      await this.validateDuelParameters(challengerId, amount, gameType, format);
      if (opponentId) {
        await this.validateDuelParameters(opponentId, amount);
      }
      
      // Проверяем что игроки разные
      if (challengerId === opponentId) {
        throw new Error('Нельзя создать дуэль с самим собой');
      }
      
      // Блокируем средства
      await this.lockUserFunds(challengerId, amount, transaction);
      if (opponentId) {
        await this.lockUserFunds(opponentId, amount, transaction);
      }
      
      // Создаем дуэль
      const duel = await Duel.create({
        challengerId,
        challengerUsername,
        opponentId,
        opponentUsername,
        gameType,
        format,
        amount,
        chatId,
        chatType,
        messageId,
        status: opponentId ? 'accepted' : 'pending'
      }, { transaction });
      
      await transaction.commit();
      
      return duel;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // Присоединение к открытой дуэли
  async joinDuel(duelId, playerId, playerUsername) {
    const transaction = await sequelize.transaction();
    
    try {
      const duel = await Duel.findByPk(duelId);
      
      if (!duel) {
        throw new Error('Дуэль не найдена');
      }
      
      if (duel.status !== 'pending' || duel.opponentId) {
        throw new Error('Дуэль уже занята или завершена');
      }
      
      if (duel.challengerId === playerId) {
        throw new Error('Нельзя присоединиться к собственной дуэли');
      }
      
      // Валидация и блокировка средств
      await this.validateDuelParameters(playerId, duel.amount);
      await this.lockUserFunds(playerId, duel.amount, transaction);
      
      // Обновляем дуэль
      await duel.update({
        opponentId: playerId,
        opponentUsername: playerUsername,
        status: 'accepted'
      }, { transaction });
      
      await transaction.commit();
      
      return duel;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // Начало игры (создание первого раунда)
  async startGame(sessionId, playerId) {
    const duel = await Duel.findOne({
      where: { sessionId },
      include: ['rounds']
    });
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }
    
    if (!duel.isParticipant(playerId)) {
      throw new Error('Вы не участвуете в этой дуэли');
    }
    
    if (duel.status !== 'accepted') {
      throw new Error('Дуэль не готова к началу');
    }
    
    // Обновляем статус дуэли
    await duel.update({ status: 'active' });
    
    // Создаем первый раунд
    const round = await DuelRound.create({
      duelId: duel.id,
      sessionId: duel.sessionId,
      roundNumber: 1,
      gameType: duel.gameType
    });
    
    return { duel, round };
  }
  
  // Сделать ход в раунде
  async makeMove(sessionId, playerId, result, messageId = null) {
    const transaction = await sequelize.transaction();
    
    try {
      const duel = await Duel.findOne({
        where: { sessionId },
        include: [{
          model: DuelRound,
          as: 'rounds',
          where: { status: { [Op.in]: ['waiting_challenger', 'waiting_opponent'] } },
          required: false,
          limit: 1,
          order: [['roundNumber', 'DESC']]
        }]
      });
      
      if (!duel || !duel.isParticipant(playerId)) {
        throw new Error('Дуэль не найдена или вы не участвуете в ней');
      }
      
      if (duel.status !== 'active') {
        throw new Error('Дуэль не активна');
      }
      
      let round = duel.rounds?.[0];
      if (!round) {
        throw new Error('Активный раунд не найден');
      }
      
      const isChallenger = duel.challengerId === playerId;
      const fieldName = isChallenger ? 'challengerResult' : 'opponentResult';
      const timestampField = isChallenger ? 'challengerTimestamp' : 'opponentTimestamp';
      const messageField = isChallenger ? 'challengerMessageId' : 'opponentMessageId';
      
      // Проверяем что игрок еще не сделал ход
      if (round[fieldName] !== null) {
        throw new Error('Вы уже сделали ход в этом раунде');
      }
      
      // Сохраняем ход
      const updateData = {
        [fieldName]: result,
        [timestampField]: new Date()
      };
      
      if (messageId) {
        updateData[messageField] = messageId;
      }
      
      await round.update(updateData, { transaction });
      
      // Если оба игрока сделали ходы, определяем победителя раунда
      if (round.challengerResult !== null && round.opponentResult !== null) {
        await this.processRoundResult(duel, round, transaction);
      } else {
        // Обновляем статус раунда
        const nextStatus = isChallenger ? 'waiting_opponent' : 'waiting_challenger';
        await round.update({ status: nextStatus }, { transaction });
      }
      
      await transaction.commit();
      
      // Возвращаем обновленную информацию
      return await this.getDuel(sessionId);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // Обработка результата раунда
  async processRoundResult(duel, round, transaction) {
    const winner = round.determineWinner(round.gameType, round.challengerResult, round.opponentResult);
    
    if (winner === 'challenger') {
      duel.challengerScore++;
      await round.update({
        winnerId: duel.challengerId,
        winnerUsername: duel.challengerUsername,
        status: 'completed'
      }, { transaction });
    } else if (winner === 'opponent') {
      duel.opponentScore++;
      await round.update({
        winnerId: duel.opponentId,
        winnerUsername: duel.opponentUsername,
        status: 'completed'
      }, { transaction });
    } else {
      // Ничья - переигрываем
      await round.update({
        isDraw: true,
        status: 'completed'
      }, { transaction });
      
      // Создаем новый раунд для переигровки
      await DuelRound.create({
        duelId: duel.id,
        sessionId: duel.sessionId,
        roundNumber: round.roundNumber + 1,
        gameType: duel.gameType
      }, { transaction });
      
      return;
    }
    
    // Обновляем счет дуэли
    await duel.update({
      challengerScore: duel.challengerScore,
      opponentScore: duel.opponentScore
    }, { transaction });
    
    // Проверяем победителя дуэли
    if (duel.challengerScore >= duel.winsRequired) {
      await this.finishDuel(duel, duel.challengerId, duel.challengerUsername, transaction);
    } else if (duel.opponentScore >= duel.winsRequired) {
      await this.finishDuel(duel, duel.opponentId, duel.opponentUsername, transaction);
    } else {
      // Создаем следующий раунд
      await DuelRound.create({
        duelId: duel.id,
        sessionId: duel.sessionId,
        roundNumber: round.roundNumber + 1,
        gameType: duel.gameType
      }, { transaction });
    }
  }
  
  // Завершение дуэли
  async finishDuel(duel, winnerId, winnerUsername, transaction) {
    // Обновляем дуэль
    await duel.update({
      status: 'completed',
      winnerId,
      winnerUsername
    }, { transaction });
    
    // Выплачиваем выигрыш и разблокируем средства
    await this.processPayouts(duel, transaction);
  }
  
  // Обработка выплат
  async processPayouts(duel, transaction) {
    const winnerId = duel.winnerId;
    const loserId = duel.challengerId === winnerId ? duel.opponentId : duel.challengerId;
    
    // Разблокируем средства проигравшего (они уже списаны)
    await this.unlockUserFunds(loserId, duel.amount, transaction);
    
    // Возвращаем средства победителю + выигрыш
    await this.unlockUserFunds(winnerId, duel.amount, transaction);
    await this.creditUserFunds(winnerId, duel.winAmount, 'duel_win', duel.sessionId, transaction);
    
    // Записываем транзакции
    await Transaction.create({
      userId: winnerId,
      type: 'duel_win',
      amount: duel.winAmount,
      description: `Выигрыш в дуэли ${duel.sessionId}`,
      metadata: { duelId: duel.id, gameType: duel.gameType }
    }, { transaction });
    
    await Transaction.create({
      userId: loserId,
      type: 'duel_loss',
      amount: -duel.amount,
      description: `Проигрыш в дуэли ${duel.sessionId}`,
      metadata: { duelId: duel.id, gameType: duel.gameType }
    }, { transaction });
    
    // Комиссия казино уже учтена в winAmount
  }
  
  // Получение информации о дуэли
  async getDuel(sessionId) {
    const duel = await Duel.findOne({
      where: { sessionId },
      include: [
        {
          model: DuelRound,
          as: 'rounds',
          order: [['roundNumber', 'ASC']]
        },
        {
          model: DuelInvitation,
          as: 'invitation',
          required: false
        }
      ]
    });
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }
    
    return duel;
  }
  
  // Получение активных дуэлей пользователя
  async getUserActiveDuels(userId) {
    const duels = await Duel.findAll({
      where: {
        [Op.or]: [
          { challengerId: userId },
          { opponentId: userId }
        ],
        status: { [Op.in]: ['pending', 'accepted', 'active'] }
      },
      include: ['rounds'],
      order: [['createdAt', 'DESC']]
    });
    
    return duels;
  }
  
  // Получение истории дуэлей пользователя
  async getUserDuelHistory(userId, limit = 20, offset = 0) {
    const duels = await Duel.findAndCountAll({
      where: {
        [Op.or]: [
          { challengerId: userId },
          { opponentId: userId }
        ],
        status: 'completed'
      },
      include: ['rounds'],
      order: [['completedAt', 'DESC']],
      limit,
      offset
    });
    
    return duels;
  }
  
  // Отмена дуэли
  async cancelDuel(sessionId, userId, reason = 'user_cancel') {
    const transaction = await sequelize.transaction();
    
    try {
      const duel = await Duel.findOne({ where: { sessionId } });
      
      if (!duel) {
        throw new Error('Дуэль не найдена');
      }
      
      if (!duel.isParticipant(userId) && reason === 'user_cancel') {
        throw new Error('Вы не можете отменить эту дуэль');
      }
      
      if (duel.status === 'completed' || duel.status === 'cancelled') {
        throw new Error('Дуэль уже завершена');
      }
      
      // Разблокируем средства
      await this.unlockUserFunds(duel.challengerId, duel.amount, transaction);
      if (duel.opponentId) {
        await this.unlockUserFunds(duel.opponentId, duel.amount, transaction);
      }
      
      // Обновляем статус
      await duel.update({
        status: 'cancelled',
        metadata: { ...duel.metadata, cancelReason: reason, cancelledBy: userId }
      }, { transaction });
      
      await transaction.commit();
      
      return duel;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
  
  async validateDuelParameters(userId, amount, gameType = null, format = null, opponentId = null, clientIp = null) {
    // Проверяем существование пользователя
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Проверяем минимальную ставку
    if (amount < 1) {
      throw new Error('Минимальная ставка: 1 USDT');
    }
    
    // Проверяем максимальную ставку
    if (amount > 1000) {
      throw new Error('Максимальная ставка: 1000 USDT');
    }
    
    // Проверяем баланс
    if (user.balance < amount) {
      throw new Error('Недостаточно средств на балансе');
    }
    
    // Проверяем тип игры
    if (gameType && !['🎲', '🎯', '⚽', '🏀', '🎳', '🎰'].includes(gameType)) {
      throw new Error('Неподдерживаемый тип игры');
    }
    
    // Проверяем формат
    if (format && !['bo1', 'bo3', 'bo5', 'bo7'].includes(format)) {
      throw new Error('Неподдерживаемый формат дуэли');
    }
    
    // IP-анализ для предотвращения сговора
    if (opponentId && clientIp) {
      await this.checkForCollusion(userId, opponentId, clientIp);
    }
    
    return true;
  }
  
  // Проверка на сговор между игроками
  async checkForCollusion(challengerId, opponentId, clientIp) {
    const { Op } = require('sequelize');
    
    // 1. Проверяем IP адреса (для WebApp)
    if (clientIp) {
      const sameIpUsers = await User.findAll({
        where: {
          lastIp: clientIp,
          telegramId: { [Op.in]: [challengerId, opponentId] }
        }
      });
      
      if (sameIpUsers.length > 1) {
        throw new Error('Дуэли с одного IP-адреса запрещены');
      }
    }
    
    // 2. Проверяем частоту дуэлей между одними игроками
    const recentDuels = await Duel.count({
      where: {
        [Op.or]: [
          {
            challengerId: challengerId,
            opponentId: opponentId
          },
          {
            challengerId: opponentId,
            opponentId: challengerId
          }
        ],
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // За последние 24 часа
        }
      }
    });
    
    if (recentDuels >= 10) {
      throw new Error('Превышен лимит дуэлей с одним противником (10 в день)');
    }
    
    // 3. Проверяем подозрительные паттерны выигрышей
    const duelsHistory = await Duel.findAll({
      where: {
        [Op.or]: [
          {
            challengerId: challengerId,
            opponentId: opponentId
          },
          {
            challengerId: opponentId,
            opponentId: challengerId
          }
        ],
        status: 'completed',
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // За последнюю неделю
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    if (duelsHistory.length >= 10) {
      // Считаем статистику побед
      let challengerWins = 0;
      let opponentWins = 0;
      
      duelsHistory.forEach(duel => {
        if (duel.winnerId === challengerId) challengerWins++;
        if (duel.winnerId === opponentId) opponentWins++;
      });
      
      const totalGames = challengerWins + opponentWins;
      const winRate = Math.max(challengerWins, opponentWins) / totalGames;
      
      // Если один из игроков выигрывает более 80% дуэлей - подозрительно
      if (winRate > 0.8) {
        throw new Error('Обнаружен подозрительный паттерн игры. Обратитесь в поддержку.');
      }
    }
    
    return true;
  }
  
  async checkUserLimits(userId) {
    // Проверяем количество активных дуэлей
    const activeDuels = await this.getUserActiveDuels(userId);
    if (activeDuels.length >= 3) {
      throw new Error('Максимум 3 активные дуэли одновременно');
    }
    
    // Проверяем cooldown (30 секунд между дуэлями)
    const recentDuel = await Duel.findOne({
      where: {
        challengerId: userId,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30000)
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (recentDuel) {
      const timeDiff = 30 - Math.floor((Date.now() - recentDuel.createdAt) / 1000);
      throw new Error(`Подождите ${timeDiff} секунд перед созданием новой дуэли`);
    }
    
    return true;
  }
  
  async lockUserFunds(userId, amount, transaction) {
    const user = await User.findByPk(userId);
    if (!user || user.balance < amount) {
      throw new Error('Недостаточно средств для блокировки');
    }
    
    await user.update({
      balance: user.balance - amount
    }, { transaction });
    
    return true;
  }
  
  async unlockUserFunds(userId, amount, transaction) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    await user.update({
      balance: user.balance + amount
    }, { transaction });
    
    return true;
  }
  
  async creditUserFunds(userId, amount, type, reference, transaction) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    await user.update({
      balance: user.balance + amount
    }, { transaction });
    
    return true;
  }
  
  // Очистка истекших приглашений
  async cleanupExpiredData() {
    const expiredInvitations = await DuelInvitation.cleanupExpired();
    
    // Отменяем истекшие дуэли
    const expiredDuels = await Duel.findAll({
      where: {
        status: 'pending',
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    });
    
    for (const duel of expiredDuels) {
      await this.cancelDuel(duel.sessionId, null, 'timeout');
    }
    
    return {
      expiredInvitations,
      expiredDuels: expiredDuels.length
    };
  }
}

module.exports = new DuelService();