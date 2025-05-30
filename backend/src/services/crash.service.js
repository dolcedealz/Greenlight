// backend/src/services/crash.service.js
const { CrashRound, User, Game, Transaction } = require('../models');
const randomService = require('./random.service');
const mongoose = require('mongoose');
const EventEmitter = require('events');

class CrashService extends EventEmitter {
  constructor() {
    super();
    this.gameTimer = null;
    this.isRunning = false;
    
    // Настройки игры
    this.WAITING_TIME = 7000; // 7 секунд ожидания
    this.CRASH_DELAY = 3000; // 3 секунды после краша
    this.MULTIPLIER_UPDATE_INTERVAL = 80; // Обновление каждые 80мс
    
    this.init();
  }
  
  async init() {
    console.log('🚀 CRASH SERVICE: Инициализация сервиса краш игры');
    
    // Восстанавливаем активный раунд из БД
    const activeRound = await CrashRound.findOne({ 
      status: { $in: ['waiting', 'flying'] } 
    }).sort({ createdAt: -1 });
    
    if (activeRound) {
      console.log(`🔄 CRASH SERVICE: Восстановление раунда #${activeRound.roundId}`);
      await this.resumeRound(activeRound);
    } else {
      // Запускаем новый раунд
      this.startGameCycle();
    }
  }
  
  async resumeRound(round) {
    // Восстанавливаем состояние из БД
    if (round.status === 'waiting') {
      // Вычисляем оставшееся время ожидания
      const elapsed = Date.now() - round.createdAt.getTime();
      const remaining = Math.max(0, this.WAITING_TIME - elapsed);
      
      if (remaining > 0) {
        console.log(`⏳ CRASH SERVICE: Продолжаем ожидание ${remaining}ms`);
        setTimeout(() => this.startFlying(round._id), remaining);
      } else {
        await this.startFlying(round._id);
      }
    } else if (round.status === 'flying') {
      // Восстанавливаем полет
      const elapsed = Date.now() - round.startedAt.getTime();
      const currentMultiplier = this.calculateMultiplier(elapsed / 1000);
      
      if (currentMultiplier >= round.crashPoint) {
        await this.crashTheGame(round._id);
      } else {
        await this.resumeFlying(round._id, currentMultiplier, elapsed);
      }
    }
  }
  
  async resumeFlying(roundId, currentMultiplier, elapsed) {
    console.log(`🔄 CRASH SERVICE: Восстановление полета на ${currentMultiplier.toFixed(2)}x`);
    
    // Восстанавливаем игровое состояние
    this.currentRound = await CrashRound.findById(roundId);
    this.currentMultiplier = currentMultiplier;
    this.gameStartTime = Date.now() - elapsed;
    
    // Эмитим текущее состояние
    this.emit('gameStarted', {
      roundId: this.currentRound.roundId,
      status: 'flying',
      multiplier: currentMultiplier
    });
    
    // Продолжаем обновление множителя
    this.updateMultiplier(roundId);
  }
  
  async crashTheGame(roundId) {
    const round = await CrashRound.findById(roundId);
    if (!round || round.status !== 'flying') return;
    
    clearInterval(this.gameTimer);
    
    // Устанавливаем точный crash point
    const crashPoint = round.crashPoint;
    
    console.log(`💥 CRASH SERVICE: Краш на ${crashPoint.toFixed(2)}x`);
    
    // Обрабатываем краш
    round.crash(crashPoint);
    await round.save();
    
    // Эмитим краш
    this.emit('gameCrashed', {
      roundId: round.roundId,
      status: 'crashed',
      crashPoint: crashPoint,
      finalMultiplier: crashPoint
    });
    
    // Обрабатываем финальные результаты
    await this.processFinalResults();
    
    // Завершаем раунд
    setTimeout(async () => {
      round.complete();
      await round.save();
      
      this.emit('roundCompleted', {
        roundId: round.roundId,
        crashPoint: round.crashPoint,
        totalBets: round.bets.length,
        totalAmount: round.totalBetAmount
      });
      
      // Запускаем новый раунд
      this.startGameCycle();
    }, this.CRASH_DELAY);
  }
  
  async getCurrentRound() {
    return await CrashRound.findOne({ 
      status: { $in: ['waiting', 'flying'] } 
    }).populate('bets.user', 'username telegramId');
  }
  
  async createNewRound() {
    const roundId = await CrashRound.getNextRoundId();
    
    // Генерируем криптографически безопасные данные
    const serverSeed = randomService.generateServerSeed();
    const serverSeedHashed = randomService.hashServerSeed(serverSeed);
    const nonce = randomService.generateNonce();
    
    // Генерируем crash point
    const crashPoint = this.generateCrashPoint(serverSeed, nonce);
    
    const round = new CrashRound({
      roundId,
      status: 'waiting',
      crashPoint,
      serverSeed,
      serverSeedHashed,
      nonce
    });
    
    await round.save();
    
    console.log(`🆕 CRASH SERVICE: Создан раунд #${roundId}, crash point: ${crashPoint.toFixed(2)}x`);
    
    // Эмитим событие для WebSocket
    this.emit('roundCreated', {
      roundId,
      serverSeedHashed,
      timeToStart: this.WAITING_TIME / 1000
    });
    
    return round;
  }
  
  async startFlying(roundId) {
    const round = await CrashRound.findById(roundId);
    if (!round || round.status !== 'waiting') return;
    
    round.startFlying();
    await round.save();
    
    console.log('🚀 CRASH SERVICE: Полет начался!');
    
    this.emit('gameStarted', {
      roundId: round.roundId,
      status: 'flying',
      multiplier: 1.00
    });
    
    // Запускаем обновление множителя
    this.updateMultiplier(round._id);
  }
  
  calculateMultiplier(elapsedSeconds) {
    // Замедленная формула роста
    const baseSpeed = 0.06;
    const acceleration = 0.03;
    return 1.00 + (baseSpeed * elapsedSeconds) + (acceleration * elapsedSeconds * elapsedSeconds / 2);
  }
  
  async updateMultiplier(roundId) {
    const round = await CrashRound.findById(roundId);
    if (!round || round.status !== 'flying') return;
    
    const startTime = round.startedAt.getTime();
    
    this.gameTimer = setInterval(async () => {
      const currentRound = await CrashRound.findById(roundId);
      if (!currentRound || currentRound.status !== 'flying') {
        clearInterval(this.gameTimer);
        return;
      }
      
      const elapsed = (Date.now() - startTime) / 1000;
      const currentMultiplier = this.calculateMultiplier(elapsed);
      
      // Проверяем краш
      if (currentMultiplier >= currentRound.crashPoint) {
        await this.crashTheGame(roundId);
        return;
      }
      
      // Обрабатываем автовыводы
      await this.processAutoCashOuts(roundId, currentMultiplier);
      
      // Эмитим обновление
      this.emit('multiplierUpdate', {
        roundId: currentRound.roundId,
        multiplier: parseFloat(currentMultiplier.toFixed(2)),
        timestamp: Date.now()
      });
      
    }, this.MULTIPLIER_UPDATE_INTERVAL);
  }
  
  getCurrentGameState() {
    // Асинхронный метод теперь возвращает Promise
    return this.getCurrentRound().then(round => {
      if (!round) {
        return {
          status: 'no_game',
          message: 'Игра инициализируется'
        };
      }
      
      const elapsed = round.status === 'flying' 
        ? (Date.now() - round.startedAt.getTime()) / 1000 
        : 0;
      
      const currentMultiplier = round.status === 'flying'
        ? this.calculateMultiplier(elapsed)
        : 1.00;
      
      return {
        roundId: round.roundId,
        status: round.status,
        currentMultiplier: parseFloat(currentMultiplier.toFixed(2)),
        serverSeedHashed: round.serverSeedHashed,
        bets: round.bets.map(bet => ({
          userId: bet.user._id,
          username: bet.user.username || 'Игрок',
          amount: bet.amount,
          autoCashOut: bet.autoCashOut,
          cashedOut: bet.cashedOut,
          cashOutMultiplier: bet.cashOutMultiplier
        })),
        timeToStart: round.status === 'waiting' 
          ? Math.max(0, 7 - Math.floor((Date.now() - round.createdAt.getTime()) / 1000))
          : 0
      };
    });
  }
  
  async startGameCycle() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🎮 CRASH SERVICE: Запуск игрового цикла');
    
    while (this.isRunning) {
      try {
        await this.runSingleRound();
      } catch (error) {
        console.error('❌ CRASH SERVICE: Ошибка в игровом цикле:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Пауза при ошибке
      }
    }
  }
  
  async runSingleRound() {
    // 1. Создаем новый раунд
    await this.createNewRound();
    
    // 2. Период ожидания ставок (7 секунд)
    await this.waitingPeriod();
    
    // 3. Период полета с растущим множителем
    await this.flyingPeriod();
    
    // 4. Пауза после краша (3 секунды)
    await this.crashPeriod();
    
    // 5. Завершаем раунд
    await this.completeRound();
  }
  
  
  async waitingPeriod() {
    console.log('⏳ CRASH SERVICE: Период ожидания ставок');
    
    let timeLeft = this.WAITING_TIME / 1000; // 7 секунд
    
    const countdown = setInterval(() => {
      timeLeft--;
      
      // Эмитим обновление таймера
      this.emit('countdownUpdate', {
        roundId: this.currentRound.roundId,
        timeToStart: timeLeft
      });
      
      if (timeLeft <= 0) {
        clearInterval(countdown);
      }
    }, 1000);
    
    // Ждем 7 секунд
    await new Promise(resolve => setTimeout(resolve, this.WAITING_TIME));
  }
  
  async flyingPeriod() {
    console.log('🚀 CRASH SERVICE: Начало полета');
    
    // Запускаем полет
    this.currentRound.startFlying();
    await this.currentRound.save();
    
    this.currentMultiplier = 1.00;
    this.gameStartTime = Date.now();
    
    // Эмитим начало полета
    this.emit('gameStarted', {
      roundId: this.currentRound.roundId,
      status: 'flying',
      multiplier: this.currentMultiplier
    });
    
    // Запускаем цикл обновления множителя
    return new Promise((resolve) => {
      const multiplierInterval = setInterval(async () => {
        const now = Date.now();
        const elapsedSeconds = (now - this.gameStartTime) / 1000;
        
        // Рассчитываем множитель (замедленная формула как на фронтенде)
        const baseSpeed = 0.06;
        const acceleration = 0.03;
        const speed = baseSpeed + (acceleration * elapsedSeconds);
        const deltaTime = this.MULTIPLIER_UPDATE_INTERVAL / 1000;
        
        this.currentMultiplier += speed * deltaTime;
        
        // Проверяем, достигли ли crash point
        if (this.currentMultiplier >= this.currentRound.crashPoint) {
          clearInterval(multiplierInterval);
          
          // Крашим точно на заданном crash point
          this.currentMultiplier = this.currentRound.crashPoint;
          
          console.log(`💥 CRASH SERVICE: Краш на ${this.currentRound.crashPoint.toFixed(2)}x`);
          
          // Обрабатываем краш
          this.currentRound.crash(this.currentRound.crashPoint);
          await this.currentRound.save();
          
          // Эмитим краш
          this.emit('gameCrashed', {
            roundId: this.currentRound.roundId,
            status: 'crashed',
            crashPoint: this.currentRound.crashPoint,
            finalMultiplier: this.currentMultiplier
          });
          
          resolve();
        } else {
          // Обрабатываем автовыводы
          await this.processAutoCashOutsLegacy();
          
          // Эмитим обновление множителя
          this.emit('multiplierUpdate', {
            roundId: this.currentRound.roundId,
            multiplier: this.currentMultiplier,
            timestamp: now
          });
        }
      }, this.MULTIPLIER_UPDATE_INTERVAL);
    });
  }
  
  async processAutoCashOuts(roundId, currentMultiplier) {
    if (!roundId) {
      // Fallback для совместимости со старым кодом
      return this.processAutoCashOutsLegacy();
    }
    
    const round = await CrashRound.findById(roundId);
    if (!round || round.status !== 'flying') return;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Находим ставки с автовыводом на текущем множителе
      const betsToProcess = round.bets.filter(bet => 
        !bet.cashedOut && 
        bet.autoCashOut > 0 && 
        bet.autoCashOut <= currentMultiplier
      );
      
      for (const bet of betsToProcess) {
        // Обновляем ставку
        const processedBet = round.cashOut(bet.user, bet.autoCashOut);
        
        // Обновляем баланс пользователя
        await User.findByIdAndUpdate(
          bet.user,
          { 
            $inc: { 
              balance: bet.amount * bet.autoCashOut,
              totalWon: bet.amount * bet.autoCashOut
            }
          }
        ).session(session);
        
        // Создаем транзакцию выигрыша
        const winTransaction = new Transaction({
          user: bet.user,
          type: 'win',
          amount: bet.amount * bet.autoCashOut,
          description: `Автовывод в краш игре при ${bet.autoCashOut.toFixed(2)}x`,
          status: 'completed'
        });
        
        await winTransaction.save({ session });
        
        // Эмитим событие автовывода
        this.emit('autoCashOut', {
          roundId: round.roundId,
          userId: bet.user,
          amount: bet.amount,
          multiplier: bet.autoCashOut,
          profit: processedBet.profit
        });
      }
      
      if (betsToProcess.length > 0) {
        await round.save({ session });
      }
      
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ CRASH SERVICE: Ошибка обработки автовыводов:', error);
    } finally {
      session.endSession();
    }
  }
  
  async processAutoCashOutsLegacy() {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Находим ставки с автовыводом на текущем множителе
      const betsToProcess = this.currentRound.bets.filter(bet => 
        !bet.cashedOut && 
        bet.autoCashOut > 0 && 
        bet.autoCashOut <= this.currentMultiplier
      );
      
      for (const bet of betsToProcess) {
        // Обновляем ставку
        const processedBet = this.currentRound.cashOut(bet.user, bet.autoCashOut);
        
        // Обновляем баланс пользователя
        await User.findByIdAndUpdate(
          bet.user,
          { 
            $inc: { 
              balance: bet.amount * bet.autoCashOut,
              totalWon: bet.amount * bet.autoCashOut
            }
          }
        ).session(session);
        
        // Создаем транзакцию выигрыша
        const winTransaction = new Transaction({
          user: bet.user,
          type: 'win',
          amount: bet.amount * bet.autoCashOut,
          description: `Автовывод в краш игре при ${bet.autoCashOut.toFixed(2)}x`,
          status: 'completed'
        });
        
        await winTransaction.save({ session });
        
        // Эмитим событие автовывода
        this.emit('autoCashOut', {
          roundId: this.currentRound.roundId,
          userId: bet.user,
          amount: bet.amount,
          multiplier: bet.autoCashOut,
          profit: processedBet.profit
        });
      }
      
      if (betsToProcess.length > 0) {
        await this.currentRound.save({ session });
      }
      
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ CRASH SERVICE: Ошибка обработки автовыводов:', error);
    } finally {
      session.endSession();
    }
  }
  
  async crashPeriod() {
    console.log('💥 CRASH SERVICE: Период после краша');
    
    // Обрабатываем все ставки и создаем игровые записи
    await this.processFinalResults();
    
    // Ждем 3 секунды
    await new Promise(resolve => setTimeout(resolve, this.CRASH_DELAY));
  }
  
  async processFinalResults() {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      for (const bet of this.currentRound.bets) {
        const user = await User.findById(bet.user).session(session);
        if (!user) continue;
        
        const win = bet.cashedOut;
        const profit = win ? bet.profit : -bet.amount;
        
        // Создаем запись об игре
        const game = new Game({
          user: bet.user,
          gameType: 'crash',
          bet: bet.amount,
          multiplier: win ? bet.cashOutMultiplier : this.currentRound.crashPoint,
          result: {
            roundId: this.currentRound.roundId,
            autoCashOut: bet.autoCashOut,
            cashedOut: bet.cashedOut,
            cashOutMultiplier: bet.cashOutMultiplier,
            crashPoint: this.currentRound.crashPoint,
            win
          },
          win,
          profit,
          balanceBefore: user.balance - (win ? 0 : bet.amount),
          balanceAfter: user.balance,
          serverSeed: this.currentRound.serverSeed,
          serverSeedHashed: this.currentRound.serverSeedHashed,
          nonce: this.currentRound.nonce,
          status: 'completed'
        });
        
        await game.save({ session });
        
        // Обновляем статистику пользователя (ставка уже списана при размещении)
        if (!win) {
          user.totalWagered += bet.amount;
        }
        
        await user.save({ session });
      }
      
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ CRASH SERVICE: Ошибка обработки финальных результатов:', error);
    } finally {
      session.endSession();
    }
  }
  
  async completeRound() {
    this.currentRound.complete();
    await this.currentRound.save();
    
    console.log(`✅ CRASH SERVICE: Раунд #${this.currentRound.roundId} завершен`);
    
    // Эмитим завершение раунда
    this.emit('roundCompleted', {
      roundId: this.currentRound.roundId,
      crashPoint: this.currentRound.crashPoint,
      totalBets: this.currentRound.bets.length,
      totalAmount: this.currentRound.totalBetAmount
    });
    
    this.currentRound = null;
  }
  
  generateCrashPoint(serverSeed, nonce) {
    // Используем провably fair алгоритм для генерации crash point
    const randomValue = randomService.generateRandomNumber(serverSeed, 'crash-client', nonce);
    
    // Конвертируем в crash point с логарифмическим распределением
    // Большинство крашей происходит на низких множителях
    if (randomValue < 0.4) {
      return 1.0 + randomValue * 0.8; // 1.0-1.8x (40%)
    } else if (randomValue < 0.7) {
      return 1.8 + (randomValue - 0.4) * 4.0; // 1.8-3.0x (30%)
    } else if (randomValue < 0.9) {
      return 3.0 + (randomValue - 0.7) * 20.0; // 3.0-7.0x (20%)
    } else {
      return 7.0 + (randomValue - 0.9) * 130.0; // 7.0-20.0x (10%)
    }
  }
  
  // Публичные методы для API
  async placeBet(userId, betAmount, autoCashOut = 0) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (user.balance < betAmount) {
        throw new Error('Недостаточно средств');
      }
      
      if (!this.currentRound || this.currentRound.status !== 'waiting') {
        throw new Error('Ставки не принимаются в данный момент');
      }
      
      // Добавляем ставку в раунд
      const bet = this.currentRound.addBet(userId, betAmount, autoCashOut);
      
      // Списываем средства с баланса
      user.balance -= betAmount;
      await user.save({ session });
      
      // Создаем транзакцию ставки
      const betTransaction = new Transaction({
        user: userId,
        type: 'bet',
        amount: -betAmount,
        description: `Ставка в краш игре #${this.currentRound.roundId}`,
        status: 'completed'
      });
      
      await betTransaction.save({ session });
      await this.currentRound.save({ session });
      
      await session.commitTransaction();
      
      // Эмитим событие новой ставки
      this.emit('betPlaced', {
        roundId: this.currentRound.roundId,
        userId,
        amount: betAmount,
        autoCashOut,
        totalBets: this.currentRound.bets.length,
        totalAmount: this.currentRound.totalBetAmount
      });
      
      return {
        success: true,
        roundId: this.currentRound.roundId,
        betAmount,
        autoCashOut,
        newBalance: user.balance
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  async manualCashOut(userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      if (!this.currentRound || this.currentRound.status !== 'flying') {
        throw new Error('Вывод невозможен в данный момент');
      }
      
      // Выводим ставку
      const bet = this.currentRound.cashOut(userId, this.currentMultiplier);
      const winAmount = bet.amount * this.currentMultiplier;
      
      // Обновляем баланс пользователя
      await User.findByIdAndUpdate(
        userId,
        { 
          $inc: { 
            balance: winAmount,
            totalWon: winAmount
          }
        }
      ).session(session);
      
      // Создаем транзакцию выигрыша
      const winTransaction = new Transaction({
        user: userId,
        type: 'win',
        amount: winAmount,
        description: `Вывод в краш игре при ${this.currentMultiplier.toFixed(2)}x`,
        status: 'completed'
      });
      
      await winTransaction.save({ session });
      await this.currentRound.save({ session });
      
      await session.commitTransaction();
      
      // Эмитим событие ручного вывода
      this.emit('manualCashOut', {
        roundId: this.currentRound.roundId,
        userId,
        amount: bet.amount,
        multiplier: this.currentMultiplier,
        profit: bet.profit
      });
      
      return {
        success: true,
        multiplier: this.currentMultiplier,
        winAmount,
        profit: bet.profit
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  getCurrentGameState() {
    if (!this.currentRound) {
      return {
        status: 'no_game',
        message: 'Игра инициализируется'
      };
    }
    
    return {
      roundId: this.currentRound.roundId,
      status: this.currentRound.status,
      currentMultiplier: this.currentMultiplier,
      serverSeedHashed: this.currentRound.serverSeedHashed,
      bets: this.currentRound.bets.map(bet => ({
        userId: bet.user,
        amount: bet.amount,
        autoCashOut: bet.autoCashOut,
        cashedOut: bet.cashedOut,
        cashOutMultiplier: bet.cashOutMultiplier
      }))
    };
  }
  
  async getGameHistory(limit = 50) {
    const rounds = await CrashRound.getLastRounds(limit);
    
    return rounds.map(round => ({
      roundId: round.roundId,
      crashPoint: round.crashPoint,
      timestamp: round.createdAt,
      totalBets: round.bets.length,
      totalAmount: round.totalBetAmount
    }));
  }
  
  async getCurrentGameStateAsync() {
    // Асинхронная версия для новой архитектуры
    const round = await this.getCurrentRound();
    if (!round) {
      return {
        status: 'no_game',
        message: 'Игра инициализируется'
      };
    }
    
    const elapsed = round.status === 'flying' 
      ? (Date.now() - round.startedAt.getTime()) / 1000 
      : 0;
    
    const currentMultiplier = round.status === 'flying'
      ? this.calculateMultiplier(elapsed)
      : 1.00;
    
    return {
      roundId: round.roundId,
      status: round.status,
      currentMultiplier: parseFloat(currentMultiplier.toFixed(2)),
      serverSeedHashed: round.serverSeedHashed,
      bets: round.bets.map(bet => ({
        userId: bet.user._id,
        username: bet.user.username || 'Игрок',
        amount: bet.amount,
        autoCashOut: bet.autoCashOut,
        cashedOut: bet.cashedOut,
        cashOutMultiplier: bet.cashOutMultiplier
      })),
      timeToStart: round.status === 'waiting' 
        ? Math.max(0, 7 - Math.floor((Date.now() - round.createdAt.getTime()) / 1000))
        : 0
    };
  }
  
  stop() {
    this.isRunning = false;
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    console.log('🛑 CRASH SERVICE: Сервис остановлен');
  }
}

module.exports = new CrashService();
