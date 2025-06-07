const mongoose = require('mongoose');
const { Duel, DuelInvitation, User, Transaction } = require('../models');
const referralService = require('./referral.service');
const casinoFinanceService = require('./casino-finance.service');

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
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Находим приглашение
      const invitation = await DuelInvitation.findOne({
        inviteId,
        status: 'pending'
      }).session(session);
      
      if (!invitation) {
        throw new Error('Приглашение не найдено или уже недействительно');
      }
      
      if (!invitation.canAccept(acceptorId, acceptorUsername)) {
        throw new Error('Вы не можете принять это приглашение');
      }
      
      // Валидация участников
      await this.validateDuelParameters(acceptorId, invitation.amount);
      
      // Блокируем средства у обоих игроков
      await this.lockUserFunds(invitation.challengerId, invitation.amount, session);
      await this.lockUserFunds(acceptorId, invitation.amount, session);
      
      // Вычисляем дополнительные поля
      const winsRequired = this.getWinsRequired(invitation.format);
      const commission = Math.round(invitation.amount * 0.05 * 100) / 100; // 5% комиссия
      const totalAmount = invitation.amount * 2;
      const winAmount = totalAmount - commission;
      
      // Создаем дуэль
      const duel = await Duel.create([{
        challengerId: invitation.challengerId,
        challengerUsername: invitation.challengerUsername,
        opponentId: acceptorId,
        opponentUsername: acceptorUsername,
        gameType: invitation.gameType,
        format: invitation.format,
        amount: invitation.amount,
        winsRequired,
        commission,
        totalAmount,
        winAmount,
        status: 'accepted',
        chatId: '0', // Будет обновлено при старте
        chatType: 'private'
      }], { session });
      
      // Обновляем приглашение
      invitation.status = 'accepted';
      invitation.targetUserId = acceptorId;
      invitation.duelId = duel[0]._id;
      await invitation.save({ session });
      
      await session.commitTransaction();
      
      return { duel: duel[0], invitation };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
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
      await this.lockUserFunds(challengerId, amount, session);
      if (opponentId) {
        await this.lockUserFunds(opponentId, amount, session);
      }
      
      // Вычисляем дополнительные поля
      const winsRequired = this.getWinsRequired(format);
      const commission = Math.round(amount * 0.05 * 100) / 100; // 5% комиссия
      const totalAmount = amount * 2;
      const winAmount = totalAmount - commission;
      
      // Создаем дуэль
      const duel = await Duel.create([{
        challengerId,
        challengerUsername,
        opponentId,
        opponentUsername,
        gameType,
        format,
        amount,
        winsRequired,
        commission,
        totalAmount,
        winAmount,
        chatId,
        chatType,
        messageId,
        status: opponentId ? 'accepted' : 'pending'
      }], { session });
      
      await session.commitTransaction();
      
      return duel[0];
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Присоединение к открытой дуэли
  async joinDuel(duelId, playerId, playerUsername) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const duel = await Duel.findById(duelId).session(session);
      
      if (!duel) {
        throw new Error('Дуэль не найдена');
      }
      
      // 🔒 КРИТИЧЕСКАЯ ПРОВЕРКА: Используем обновленный метод canAccept
      if (!duel.canAccept(playerId, playerUsername)) {
        // Определяем причину отказа
        if (duel.status !== 'pending') {
          throw new Error('Дуэль уже недоступна для принятия');
        } else if (duel.isExpired()) {
          throw new Error('Время принятия дуэли истекло');
        } else if (duel.challengerId === playerId) {
          throw new Error('Нельзя присоединиться к собственной дуэли');
        } else if (duel.opponentId && duel.opponentId !== playerId) {
          throw new Error('Дуэль уже занята другим игроком');
        } else if (duel.opponentUsername && playerUsername && duel.opponentUsername !== playerUsername) {
          throw new Error(`Этот вызов предназначен для @${duel.opponentUsername}`);
        } else {
          throw new Error('Невозможно принять данную дуэль');
        }
      }
      
      // Валидация и блокировка средств
      await this.validateDuelParameters(playerId, duel.amount);
      await this.lockUserFunds(playerId, duel.amount, session);
      
      // Обновляем дуэль
      duel.opponentId = playerId;
      duel.opponentUsername = playerUsername;
      duel.status = 'accepted';
      await duel.save({ session });
      
      await session.commitTransaction();
      
      return duel;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Начало игры (создание первого раунда)
  async startGame(sessionId, playerId) {
    const duel = await Duel.findOne({ sessionId });
    
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
    duel.status = 'active';
    
    // Создаем первый раунд если его еще нет
    if (duel.rounds.length === 0) {
      const firstRound = {
        roundNumber: 1,
        challengerResult: null,
        opponentResult: null,
        winnerId: null,
        timestamp: new Date()
      };
      duel.rounds.push(firstRound);
    }
    
    await duel.save();
    
    return { duel, round: duel.rounds[0] };
  }
  
  // Сделать ход в дуэли
  async makeMove(sessionId, playerId, result, messageId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const duel = await Duel.findOne({ sessionId }).session(session);
      
      if (!duel || !duel.isParticipant(playerId)) {
        throw new Error('Дуэль не найдена или вы не участвуете в ней');
      }
      
      // Проверяем что дуэль не завершена
      if (duel.status === 'completed' || duel.status === 'cancelled') {
        throw new Error(`Дуэль уже завершена (статус: ${duel.status})`);
      }
      
      // Автоматически активируем дуэль если она принята
      if (duel.status === 'accepted') {
        duel.status = 'active';
        duel.startedAt = new Date();
        
        // Создаем первый раунд если его еще нет
        if (duel.rounds.length === 0) {
          const firstRound = {
            roundNumber: 1,
            challengerResult: null,
            opponentResult: null,
            winnerId: null,
            timestamp: new Date()
          };
          duel.rounds.push(firstRound);
        }
      }
      
      if (duel.status !== 'active') {
        throw new Error(`Дуэль не активна (статус: ${duel.status})`);
      }
      
      const isChallenger = duel.challengerId === playerId;
      
      // Находим или создаем текущий раунд
      let currentRound = duel.rounds.find(round => 
        (isChallenger && round.challengerResult === null) || 
        (!isChallenger && round.opponentResult === null)
      );
      
      if (!currentRound) {
        // Создаем новый раунд
        currentRound = {
          roundNumber: duel.rounds.length + 1,
          challengerResult: null,
          opponentResult: null,
          winnerId: null,
          timestamp: new Date()
        };
        duel.rounds.push(currentRound);
      }
      
      // Сохраняем результат
      if (isChallenger) {
        if (currentRound.challengerResult !== null) {
          throw new Error('Вы уже сделали ход в этом раунде');
        }
        currentRound.challengerResult = result;
      } else {
        if (currentRound.opponentResult !== null) {
          throw new Error('Вы уже сделали ход в этом раунде');
        }
        currentRound.opponentResult = result;
      }
      
      // Если оба игрока сделали ходы, определяем победителя раунда
      if (currentRound.challengerResult !== null && currentRound.opponentResult !== null) {
        console.log(`🎲 Оба игрока сделали ходы. Обрабатываем результат раунда...`);
        await this.processRoundResult(duel, currentRound, session);
      }
      
      // ВАЖНО: сохраняем только если дуэль еще активна
      if (duel.status === 'active' || duel.status === 'completed') {
        await duel.save({ session });
      }
      
      await session.commitTransaction();
      
      return duel;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Обработка результата раунда
  async processRoundResult(duel, round, session) {
    console.log(`🎲 Обработка результата раунда ${round.roundNumber}:`, {
      gameType: duel.gameType,
      challengerResult: round.challengerResult,
      opponentResult: round.opponentResult,
      challengerScore: duel.challengerScore,
      opponentScore: duel.opponentScore,
      winsRequired: duel.winsRequired,
      format: duel.format
    });
    
    const winner = this.determineWinner(duel.gameType, round.challengerResult, round.opponentResult);
    console.log(`🏆 Победитель раунда: ${winner}`);
    
    if (winner === 'challenger') {
      duel.challengerScore++;
      round.winnerId = duel.challengerId;
    } else if (winner === 'opponent') {
      duel.opponentScore++;
      round.winnerId = duel.opponentId;
    } else {
      // Ничья - создаем новый раунд для переигровки
      console.log('🤝 Ничья! Создаем новый раунд для переигровки');
      const newRound = {
        roundNumber: duel.rounds.length + 1,
        challengerResult: null,
        opponentResult: null,
        winnerId: null,
        timestamp: new Date()
      };
      duel.rounds.push(newRound);
      await duel.save({ session });
      return;
    }
    
    console.log(`📊 Обновленный счёт: ${duel.challengerScore}:${duel.opponentScore} (нужно ${duel.winsRequired} для победы)`);
    
    // Проверяем победителя дуэли
    if (duel.challengerScore >= duel.winsRequired) {
      console.log(`🎆 Дуэль завершена! Победитель: ${duel.challengerUsername} (challenger)`);
      await this.finishDuel(duel, duel.challengerId, duel.challengerUsername, session);
    } else if (duel.opponentScore >= duel.winsRequired) {
      console.log(`🎆 Дуэль завершена! Победитель: ${duel.opponentUsername} (opponent)`);
      await this.finishDuel(duel, duel.opponentId, duel.opponentUsername, session);
    } else {
      console.log(`🔄 Дуэль продолжается... Нужно ещё раундов`);
      // Создаем новый раунд для продолжения игры
      const newRound = {
        roundNumber: duel.rounds.length + 1,
        challengerResult: null,
        opponentResult: null,
        winnerId: null,
        timestamp: new Date()
      };
      duel.rounds.push(newRound);
      console.log(`📝 Создан новый раунд #${newRound.roundNumber} для продолжения дуэли`);
    }
  }
  
  // Завершение дуэли
  async finishDuel(duel, winnerId, winnerUsername, session) {
    console.log(`🎯 Завершаем дуэль ${duel.sessionId}:`, {
      winnerId,
      winnerUsername,
      finalScore: `${duel.challengerScore}:${duel.opponentScore}`
    });
    
    // Обновляем дуэль
    duel.status = 'completed';
    duel.winnerId = winnerId;
    duel.winnerUsername = winnerUsername;
    duel.completedAt = new Date();
    await duel.save({ session });
    
    console.log(`✅ Дуэль ${duel.sessionId} завершена со статусом: ${duel.status}`);
    
    // Выплачиваем выигрыш и разблокируем средства
    await this.processPayouts(duel, session);
  }
  
  // Обработка выплат
  async processPayouts(duel, session) {
    const winnerId = duel.winnerId;
    const loserId = duel.challengerId === winnerId ? duel.opponentId : duel.challengerId;
    
    console.log(`💰 PAYOUTS: Обработка выплат для дуэли ${duel.sessionId}`);
    console.log(`💰 PAYOUTS: Победитель: ${winnerId}, Проигравший: ${loserId}`);
    console.log(`💰 PAYOUTS: Сумма ставки: ${duel.amount}, Выигрыш: ${duel.winAmount}`);
    
    // Убираем заблокированные средства проигравшего БЕЗ возврата на баланс
    await this.removeLockedFunds(loserId, duel.amount, session);
    
    // Убираем заблокированные средства победителя БЕЗ возврата (они уже были списаны при блокировке)
    await this.removeLockedFunds(winnerId, duel.amount, session);
    
    // Начисляем победителю полный выигрыш (его ставка + выигрыш)
    await this.creditUserFunds(winnerId, duel.winAmount, 'duel_win', duel.sessionId, session);
    
    // Находим пользователей для транзакций
    const winner = await User.findOne({ telegramId: parseInt(winnerId) }).session(session);
    const loser = await User.findOne({ telegramId: parseInt(loserId) }).session(session);
    
    if (!winner || !loser) {
      throw new Error('Пользователи не найдены');
    }
    
    // Записываем транзакции
    await Transaction.create([{
      user: winner._id,
      type: 'win',
      amount: duel.winAmount,
      description: `Выигрыш в дуэли ${duel.sessionId}`,
      balanceBefore: winner.balance - duel.winAmount,
      balanceAfter: winner.balance
    }], { session });
    
    await Transaction.create([{
      user: loser._id,
      type: 'bet',
      amount: -duel.amount,
      description: `Проигрыш в дуэли ${duel.sessionId}`,
      balanceBefore: loser.balance + duel.amount,
      balanceAfter: loser.balance
    }], { session });
    
    // Обрабатываем реферальные начисления с комиссии казино
    try {
      const referralResults = await referralService.processCommission({
        winnerId: duel.winnerId,
        loserId: loserId,
        commission: duel.commission,
        gameType: 'duel',
        gameId: duel.sessionId
      });
      
      if (referralResults.length > 0) {
        console.log(`✅ Обработано ${referralResults.length} реферальное начисление для дуэли ${duel.sessionId} (с проигравшего)`);
        referralResults.forEach(result => {
          console.log(`   💰 ${result.earnedAmount} USDT → @${result.partnerUsername} (${result.commissionPercent}% от ${duel.commission} USDT комиссии)`);
        });
      } else {
        console.log(`ℹ️ Реферальных начислений нет для дуэли ${duel.sessionId} (у проигравшего нет реферера)`);
      }
    } catch (referralError) {
      console.error(`❌ Ошибка обработки реферальных начислений для дуэли ${duel.sessionId}:`, referralError);
      // Не прерываем выполнение - дуэль должна завершиться даже если реферальные не обработались
    }
    
    // Обновляем финансы казино (добавляем комиссию в оперативный баланс)
    await casinoFinanceService.updateAfterDuel({
      sessionId: duel.sessionId,
      commission: duel.commission,
      amount: duel.amount
    });
    
    console.log(`💰 Комиссия ${duel.commission} USDT добавлена в оперативный баланс казино`);
  }
  
  // Получение информации о дуэли
  async getDuel(sessionId) {
    const duel = await Duel.findOne({ sessionId });
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }
    
    return duel;
  }
  
  // Получение активных дуэлей пользователя
  async getUserActiveDuels(userId) {
    const duels = await Duel.find({
      $or: [
        { challengerId: userId },
        { opponentId: userId }
      ],
      status: { $in: ['pending', 'accepted', 'active'] }
    })
      .sort({ createdAt: -1 });
    
    return duels;
  }
  
  // Получение истории дуэлей пользователя
  async getUserDuelHistory(userId, limit = 20, offset = 0) {
    const query = {
      $or: [
        { challengerId: userId },
        { opponentId: userId }
      ],
      status: 'completed'
    };
    
    const [duels, total] = await Promise.all([
      Duel.find(query)
        .sort({ completedAt: -1 })
        .limit(limit)
        .skip(offset),
      Duel.countDocuments(query)
    ]);
    
    return {
      rows: duels,
      count: total
    };
  }
  
  // Отмена дуэли
  async cancelDuel(sessionId, userId, reason = 'user_cancel') {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const duel = await Duel.findOne({ sessionId }).session(session);
      
      if (!duel) {
        throw new Error('Дуэль не найдена');
      }
      
      // 🔧 УЛУЧШЕННАЯ ЛОГИКА ОТМЕНЫ: проверяем права более точно
      if (reason === 'user_cancel' && userId) {
        // Преобразуем userId в строку для сравнения
        const userIdStr = userId.toString();
        const isChallenger = duel.challengerId === userIdStr || duel.challengerId === userId;
        const isOpponent = duel.opponentId === userIdStr || duel.opponentId === userId;
        
        console.log(`🚫 CANCEL LOGIC: Проверка прав отмены`);
        console.log(`🚫 CANCEL LOGIC: userId: ${userId} (${typeof userId})`);
        console.log(`🚫 CANCEL LOGIC: challengerId: ${duel.challengerId} (${typeof duel.challengerId})`);
        console.log(`🚫 CANCEL LOGIC: opponentId: ${duel.opponentId} (${typeof duel.opponentId})`);
        console.log(`🚫 CANCEL LOGIC: isChallenger: ${isChallenger}, isOpponent: ${isOpponent}`);
        console.log(`🚫 CANCEL LOGIC: duel status: ${duel.status}`);
        
        // Для pending дуэлей:
        if (duel.status === 'pending') {
          // Только создатель может отменить pending дуэль
          if (!isChallenger) {
            throw new Error('Только создатель может отменить непринятую дуэль');
          }
        }
        
        // Для принятых/активных дуэлей: только участники могут отменить
        if ((duel.status === 'accepted' || duel.status === 'active')) {
          if (!isChallenger && !isOpponent) {
            throw new Error('Только участники дуэли могут её отменить');
          }
        }
      }
      
      if (duel.status === 'completed' || duel.status === 'cancelled') {
        throw new Error('Дуэль уже завершена');
      }
      
      // Разблокируем средства
      console.log(`💰 CANCEL: Разблокируем средства для дуэли ${sessionId} (статус: ${duel.status})`);
      
      // Всегда возвращаем средства создателю
      console.log(`💰 CANCEL: Возвращаем ${duel.amount} USDT создателю ${duel.challengerId}`);
      await this.unlockUserFunds(duel.challengerId, duel.amount, session);
      
      // Возвращаем средства оппоненту только если дуэль была принята (есть opponentId)
      if (duel.opponentId && (duel.status === 'accepted' || duel.status === 'active')) {
        console.log(`💰 CANCEL: Возвращаем ${duel.amount} USDT оппоненту ${duel.opponentId}`);
        await this.unlockUserFunds(duel.opponentId, duel.amount, session);
      } else if (duel.status === 'pending') {
        console.log(`💰 CANCEL: Дуэль была в ожидании, возвращаем средства только создателю`);
      }
      
      // Обновляем статус
      duel.status = 'cancelled';
      duel.metadata = { ...duel.metadata, cancelReason: reason, cancelledBy: userId };
      await duel.save({ session });
      
      await session.commitTransaction();
      
      return duel;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
  
  async validateDuelParameters(userId, amount, gameType = null, format = null, opponentId = null, clientIp = null) {
    // Проверяем существование пользователя
    const user = await User.findOne({ telegramId: parseInt(userId) });
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
    if (gameType && !['🎲', '🎯', '⚽', '⚽️', '🏀', '🎳', '🎰'].includes(gameType)) {
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
    // 1. Проверяем IP адреса (для WebApp)
    if (clientIp) {
      const sameIpUsers = await User.find({
        lastIp: clientIp,
        telegramId: { $in: [parseInt(challengerId), parseInt(opponentId)] }
      });
      
      if (sameIpUsers.length > 1) {
        throw new Error('Дуэли с одного IP-адреса запрещены');
      }
    }
    
    // 2. Проверяем частоту дуэлей между одними игроками
    const recentDuels = await Duel.countDocuments({
      $or: [
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
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // За последние 24 часа
      }
    });
    
    if (recentDuels >= 10) {
      throw new Error('Превышен лимит дуэлей с одним противником (10 в день)');
    }
    
    // 3. Проверяем подозрительные паттерны выигрышей
    const duelsHistory = await Duel.find({
      $or: [
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
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // За последнюю неделю
      }
    })
      .sort({ createdAt: -1 })
      .limit(20);
    
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
      challengerId: userId,
      createdAt: {
        $gte: new Date(Date.now() - 30000)
      }
    })
      .sort({ createdAt: -1 });
    
    if (recentDuel) {
      const timeDiff = 30 - Math.floor((Date.now() - recentDuel.createdAt) / 1000);
      throw new Error(`Подождите ${timeDiff} секунд перед созданием новой дуэли`);
    }
    
    return true;
  }
  
  async lockUserFunds(userId, amount, session) {
    // Атомарная операция блокировки средств
    const result = await User.findOneAndUpdate(
      { 
        telegramId: parseInt(userId),
        balance: { $gte: amount }  // Атомарная проверка достаточности средств
      },
      { 
        $inc: { balance: -amount },
        $push: { 
          lockedFunds: { 
            amount, 
            reason: 'duel', 
            lockedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 минут
          }
        }
      },
      { session, new: true }
    );
    
    if (!result) {
      throw new Error('Недостаточно средств для блокировки');
    }
    
    return true;
  }
  
  async unlockUserFunds(userId, amount, session) {
    console.log(`🔓 UNLOCK: Начинаем разблокировку ${amount} USDT для пользователя ${userId}`);
    
    // Сначала найдем пользователя и проверим его текущее состояние
    const userBefore = await User.findOne({ telegramId: parseInt(userId) }).session(session);
    if (!userBefore) {
      console.error(`❌ UNLOCK: Пользователь ${userId} не найден!`);
      throw new Error('Пользователь не найден');
    }
    
    console.log(`🔓 UNLOCK: Баланс до: ${userBefore.balance}, заблокированные средства:`, userBefore.lockedFunds);
    
    // Атомарная операция разблокировки средств
    const result = await User.findOneAndUpdate(
      { telegramId: parseInt(userId) },
      { 
        $inc: { balance: amount },
        $pull: { 
          lockedFunds: { 
            amount, 
            reason: 'duel' 
          }
        }
      },
      { session, new: true }
    );
    
    if (!result) {
      console.error(`❌ UNLOCK: Не удалось обновить пользователя ${userId}`);
      throw new Error('Пользователь не найден');
    }
    
    console.log(`✅ UNLOCK: Баланс после: ${result.balance}, заблокированные средства:`, result.lockedFunds);
    console.log(`✅ UNLOCK: Успешно разблокировано ${amount} USDT для пользователя ${userId}`);
    
    return true;
  }
  
  // Новый метод для удаления заблокированных средств БЕЗ возврата на баланс
  async removeLockedFunds(userId, amount, session) {
    console.log(`🔒 REMOVE LOCKED: Удаляем заблокированные ${amount} USDT для пользователя ${userId} БЕЗ возврата`);
    
    // Атомарная операция удаления из lockedFunds БЕЗ изменения баланса
    const result = await User.findOneAndUpdate(
      { telegramId: parseInt(userId) },
      { 
        $pull: { 
          lockedFunds: { 
            amount, 
            reason: 'duel' 
          }
        }
      },
      { session, new: true }
    );
    
    if (!result) {
      console.error(`❌ REMOVE LOCKED: Не удалось обновить пользователя ${userId}`);
      throw new Error('Пользователь не найден');
    }
    
    console.log(`✅ REMOVE LOCKED: Заблокированные средства удалены для пользователя ${userId}`);
    
    return true;
  }
  
  async creditUserFunds(userId, amount, type, reference, session) {
    const user = await User.findOne({ telegramId: parseInt(userId) }).session(session);
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    user.balance += amount;
    await user.save({ session });
    
    return true;
  }
  
  // Очистка истекших приглашений
  async cleanupExpiredData() {
    const expiredInvitations = await DuelInvitation.cleanupExpired();
    
    // Отменяем истекшие дуэли
    const expiredDuels = await Duel.find({
      status: 'pending',
      expiresAt: {
        $lt: new Date()
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
  
  // Получить количество требуемых побед для формата
  getWinsRequired(format) {
    const formatMap = {
      'bo1': 1,
      'bo3': 2,
      'bo5': 3,
      'bo7': 4
    };
    return formatMap[format] || 1;
  }
  
  // Определение победителя раунда
  determineWinner(gameType, challengerResult, opponentResult) {
    if (challengerResult === null || opponentResult === null) {
      return null; // Раунд не завершен
    }
    
    // Для всех игр: больше = лучше
    if (challengerResult > opponentResult) {
      return 'challenger';
    } else if (opponentResult > challengerResult) {
      return 'opponent';
    } else {
      return 'draw'; // Ничья
    }
  }
}

module.exports = new DuelService();