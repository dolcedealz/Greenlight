// backend/src/services/crash.service.js
const { CrashRound, User, Game, Transaction } = require('../models');
const randomService = require('./random.service');
const oddsService = require('./odds.service');
const referralService = require('./referral.service');
const { CRASH_GAME_CONFIG } = require('../../../common/constants');
const mongoose = require('mongoose');
const EventEmitter = require('events');

class CrashService extends EventEmitter {
  constructor() {
    super();
    this.currentRound = null;
    this.gameTimer = null;
    this.countdownTimer = null;
    this.isRunning = false;
    this.currentMultiplier = 1.00;
    this.gameStartTime = null;
    
    // Глобальный модификатор для всей игры Crash
    this.globalCrashModifier = 0;
    
    // Настройки игры (синхронизированы через common/constants.js)
    this.WAITING_TIME = CRASH_GAME_CONFIG.WAITING_TIME; // 7000мс
    this.CRASH_DELAY = CRASH_GAME_CONFIG.CRASH_DELAY; // 3000мс
    this.MULTIPLIER_UPDATE_INTERVAL = CRASH_GAME_CONFIG.MULTIPLIER_UPDATE_INTERVAL; // 80мс
    
    // Привязываем контекст для всех методов
    this.startGameCycle = this.startGameCycle.bind(this);
    this.runSingleRound = this.runSingleRound.bind(this);
    this.createNewRound = this.createNewRound.bind(this);
    this.waitingPeriod = this.waitingPeriod.bind(this);
    this.flyingPeriod = this.flyingPeriod.bind(this);
    this.crashPeriod = this.crashPeriod.bind(this);
    this.completeRound = this.completeRound.bind(this);
    
    this.init();
  }
  
  async init() {
    console.log('🚀 CRASH SERVICE: Инициализация сервиса краш игры');
    
    try {
      // Завершаем любые активные раунды при запуске
      await CrashRound.updateMany(
        { status: { $in: ['waiting', 'flying'] } },
        { status: 'completed' }
      );
      
      // Запускаем игровой цикл
      this.startGameCycle();
    } catch (error) {
      console.error('❌ CRASH SERVICE: Ошибка инициализации:', error);
      // Пробуем перезапустить через 5 секунд
      setTimeout(() => this.init(), 5000);
    }
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
  
  async createNewRound() {
    try {
      const roundId = await CrashRound.getNextRoundId();
      
      // Генерируем криптографически безопасные данные
      const serverSeed = randomService.generateServerSeed();
      const serverSeedHashed = randomService.hashServerSeed(serverSeed);
      const nonce = randomService.generateNonce();
      
      // Генерируем crash point используя provably fair алгоритм
      const crashPoint = this.generateCrashPoint(serverSeed, nonce);
      
      this.currentRound = new CrashRound({
        roundId,
        status: 'waiting',
        crashPoint,
        serverSeed,
        serverSeedHashed,
        nonce,
        gameData: {}
      });
      
      await this.currentRound.save();
      
      console.log(`🆕 CRASH SERVICE: Создан раунд #${roundId}, crash point: ${crashPoint.toFixed(2)}x`);
      
      // Эмитим событие для WebSocket
      this.emit('roundCreated', {
        roundId,
        status: 'waiting',
        serverSeedHashed,
        timeToStart: this.WAITING_TIME / 1000
      });
    } catch (error) {
      console.error('❌ CRASH SERVICE: Ошибка создания раунда:', error);
      throw error;
    }
  }
  
  async waitingPeriod() {
    console.log('⏳ CRASH SERVICE: Период ожидания ставок');
    
    let timeLeft = this.WAITING_TIME / 1000; // 7 секунд
    
    return new Promise((resolve) => {
      // Сохраняем текущий roundId для проверки
      const currentRoundId = this.currentRound?.roundId;
      
      this.countdownTimer = setInterval(() => {
        // Проверяем, что раунд все еще актуален
        if (!this.currentRound || this.currentRound.roundId !== currentRoundId) {
          if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
          }
          resolve();
          return;
        }
        
        timeLeft--;
        
        // Эмитим обновление таймера
        this.emit('countdownUpdate', {
          roundId: this.currentRound.roundId,
          timeToStart: timeLeft
        });
        
        if (timeLeft <= 0) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          resolve();
        }
      }, 1000);
    });
  }
  
  async flyingPeriod() {
    if (!this.currentRound) {
      console.error('❌ CRASH SERVICE: Нет активного раунда для полета');
      return;
    }
    
    console.log('🚀 CRASH SERVICE: Начало полета');
    
    try {
      // Запускаем полет
      await CrashRound.findByIdAndUpdate(
        this.currentRound._id,
        { 
          status: 'flying',
          startedAt: new Date()
        }
      );
      this.currentRound.status = 'flying';
      this.currentRound.startedAt = new Date();
      
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
        // Сохраняем текущий roundId и crashPoint
        const currentRoundId = this.currentRound.roundId;
        const crashPoint = this.currentRound.crashPoint;
        
        const multiplierInterval = setInterval(async () => {
          // Проверяем, что раунд все еще актуален
          if (!this.currentRound || this.currentRound.roundId !== currentRoundId) {
            clearInterval(multiplierInterval);
            resolve();
            return;
          }
          
          const now = Date.now();
          const elapsedSeconds = (now - this.gameStartTime) / 1000;
          
          // Рассчитываем множитель (замедленная формула как на фронтенде)
          const baseSpeed = 0.06;
          const acceleration = 0.03;
          const speed = baseSpeed + (acceleration * elapsedSeconds);
          const deltaTime = this.MULTIPLIER_UPDATE_INTERVAL / 1000;
          
          this.currentMultiplier += speed * deltaTime;
          
          // Проверяем, достигли ли crash point
          if (this.currentMultiplier >= crashPoint) {
            clearInterval(multiplierInterval);
            
            // Крашим точно на заданном crash point
            this.currentMultiplier = crashPoint;
            
            console.log(`💥 CRASH SERVICE: Краш на ${crashPoint.toFixed(2)}x`);
            
            // Обрабатываем краш
            if (this.currentRound) {
              await CrashRound.findByIdAndUpdate(
                this.currentRound._id,
                { 
                  status: 'crashed',
                  crashedAt: new Date(),
                  finalMultiplier: crashPoint
                }
              );
              this.currentRound.status = 'crashed';
              this.currentRound.crashedAt = new Date();
              this.currentRound.finalMultiplier = crashPoint;
              
              // Эмитим краш
              this.emit('gameCrashed', {
                roundId: currentRoundId,
                status: 'crashed',
                crashPoint: crashPoint,
                finalMultiplier: this.currentMultiplier
              });
            }
            
            resolve();
          } else {
            // Обрабатываем автовыводы
            await this.processAutoCashOuts();
            
            // Эмитим обновление множителя
            this.emit('multiplierUpdate', {
              roundId: currentRoundId,
              multiplier: this.currentMultiplier,
              timestamp: now
            });
          }
        }, this.MULTIPLIER_UPDATE_INTERVAL);
      });
    } catch (error) {
      console.error('❌ CRASH SERVICE: Ошибка в период полета:', error);
      throw error;
    }
  }
  
  async processAutoCashOuts() {
    if (!this.currentRound) return;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Находим ставки с автовыводом на текущем множителе
      const betsToProcess = this.currentRound.bets.filter(bet => 
        !bet.cashedOut && 
        bet.autoCashOut > 0 && 
        bet.autoCashOut <= this.currentMultiplier
      );
      
      if (betsToProcess.length === 0) {
        await session.commitTransaction();
        return;
      }
      
      // Подготавливаем обновления для всех ставок
      const betUpdates = [];
      
      for (const bet of betsToProcess) {
        try {
          const winAmount = bet.amount * bet.autoCashOut;
          const profit = winAmount - bet.amount;
          
          // Обновляем локальную копию ставки
          bet.cashedOut = true;
          bet.cashOutMultiplier = bet.autoCashOut;
          bet.profit = profit;
          bet.cashedOutAt = new Date();
          
          // Обновляем баланс пользователя
          await User.findByIdAndUpdate(
            bet.user,
            { 
              $inc: { 
                balance: winAmount,
                totalWon: winAmount
              }
            }
          ).session(session);
          
          // Создаем транзакцию выигрыша
          const winTransaction = new Transaction({
            user: bet.user,
            type: 'win',
            amount: winAmount,
            description: `Автовывод в краш игре при ${bet.autoCashOut.toFixed(2)}x`,
            status: 'completed',
            balanceBefore: 0, // Будет обновлено
            balanceAfter: 0  // Будет обновлено
          });
          
          await winTransaction.save({ session });
          
          // Получаем имя пользователя и новый баланс для события
          const user = await User.findById(bet.user).select('username balance').session(session);
          
          // Эмитим событие автовывода
          this.emit('autoCashOut', {
            roundId: this.currentRound.roundId,
            userId: bet.user,
            username: user?.username || 'Игрок',
            amount: bet.amount,
            multiplier: bet.autoCashOut,
            profit: profit,
            balanceAfter: user?.balance || 0
          });
        } catch (betError) {
          console.error(`❌ CRASH SERVICE: Ошибка автовывода для пользователя ${bet.user}:`, betError);
        }
      }
      
      // ИСПРАВЛЕНИЕ: Используем одну атомарную операцию для обновления всех ставок
      await CrashRound.findByIdAndUpdate(
        this.currentRound._id,
        { 
          $set: { bets: this.currentRound.bets }
        },
        { session }
      );
      
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
    if (!this.currentRound) return;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      for (const bet of this.currentRound.bets) {
        try {
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
          
          // Обрабатываем реферальную комиссию при проигрыше
          if (!win) {
            try {
              await referralService.processGameLoss({
                userId: bet.user,
                gameId: game._id,
                gameType: 'crash',
                bet: bet.amount,
                profit: profit
              });
              console.log(`💰 CRASH REFERRAL: Обработана реферальная комиссия для пользователя ${bet.user}, ставка ${bet.amount}`);
            } catch (refError) {
              console.error('❌ CRASH REFERRAL: Ошибка обработки реферальной комиссии:', refError);
            }
          }
        } catch (betError) {
          console.error(`❌ CRASH SERVICE: Ошибка обработки результата для ставки:`, betError);
        }
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
    if (!this.currentRound) return;
    
    try {
      await CrashRound.findByIdAndUpdate(
        this.currentRound._id,
        { 
          status: 'completed',
          completedAt: new Date()
        }
      );
      this.currentRound.status = 'completed';
      this.currentRound.completedAt = new Date();
      
      console.log(`✅ CRASH SERVICE: Раунд #${this.currentRound.roundId} завершен`);
      
      // Эмитим завершение раунда
      this.emit('roundCompleted', {
        roundId: this.currentRound.roundId,
        crashPoint: this.currentRound.crashPoint,
        totalBets: this.currentRound.bets.length,
        totalAmount: this.currentRound.totalBetAmount
      });
    } catch (error) {
      console.error('❌ CRASH SERVICE: Ошибка завершения раунда:', error);
    } finally {
      this.currentRound = null;
    }
  }
  
  generateCrashPoint(serverSeed, nonce) {
    // Используем провably fair алгоритм для генерации crash point
    let randomValue = randomService.generateRandomNumber(serverSeed, 'crash-client', nonce);
    
    // ИНТЕГРАЦИЯ МОДИФИКАТОРА: Получаем глобальный модификатор для всей игры
    // В будущем это может быть настройка администратора для всего казино
    const globalCrashModifier = this.globalCrashModifier || 0;
    
    if (globalCrashModifier !== 0) {
      console.log(`CRASH: Применяется глобальный модификатор: ${globalCrashModifier}%`);
      
      // Модификатор увеличивает шанс раннего краша
      if (globalCrashModifier > 0) {
        // Увеличиваем вероятность низких множителей
        randomValue = randomValue * (1 - globalCrashModifier / 200); // Макс эффект 25% при модификаторе 50%
      } else if (globalCrashModifier < 0) {
        // Уменьшаем вероятность низких множителей
        randomValue = Math.min(0.99, randomValue * (1 - globalCrashModifier / 200));
      }
    }
    
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
      
      if (user.isBlocked) {
        throw new Error('Ваш аккаунт заблокирован');
      }
      
      if (!this.currentRound || this.currentRound.status !== 'waiting') {
        throw new Error('Ставки не принимаются в данный момент');
      }
      
      // Проверяем, что у пользователя нет активной ставки
      const existingBet = this.currentRound.bets.find(bet => 
        bet.user.toString() === userId.toString()
      );
      
      if (existingBet) {
        throw new Error('У вас уже есть ставка в этом раунде');
      }
      
      // Проверяем баланс
      if (user.balance < betAmount) {
        throw new Error('Недостаточно средств');
      }
      
      // Создаем объект ставки
      const bet = {
        user: userId,
        amount: betAmount,
        autoCashOut: autoCashOut,
        cashedOut: false,
        cashOutMultiplier: 0,
        profit: 0,
        placedAt: new Date()
      };
      
      // ИСПРАВЛЕНИЕ: Используем атомарную операцию вместо save()
      await CrashRound.findByIdAndUpdate(
        this.currentRound._id,
        { 
          $push: { bets: bet }
        },
        { session }
      );
      
      // Обновляем локальный объект
      this.currentRound.bets.push(bet);
      
      // Списываем средства с баланса
      user.balance -= betAmount;
      await user.save({ session });
      
      // Создаем транзакцию ставки
      const betTransaction = new Transaction({
        user: userId,
        type: 'bet',
        amount: -betAmount,
        description: `Ставка в краш игре #${this.currentRound.roundId}`,
        status: 'completed',
        balanceBefore: user.balance + betAmount,
        balanceAfter: user.balance
      });
      
      await betTransaction.save({ session });
      
      await session.commitTransaction();
      
      // Эмитим событие новой ставки
      this.emit('betPlaced', {
        roundId: this.currentRound.roundId,
        userId,
        username: user.username || 'Игрок',
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
        balanceAfter: user.balance
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  async manualCashOut(userId) {
    if (!this.currentRound || this.currentRound.status !== 'flying') {
      throw new Error('Вывод невозможен в данный момент');
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Находим индекс ставки пользователя
      const betIndex = this.currentRound.bets.findIndex(b => 
        b.user.toString() === userId.toString() && !b.cashedOut
      );
      
      if (betIndex === -1) {
        throw new Error('Активная ставка не найдена');
      }
      
      const bet = this.currentRound.bets[betIndex];
      const winAmount = bet.amount * this.currentMultiplier;
      const profit = winAmount - bet.amount;
      
      // Обновляем локальную копию
      bet.cashedOut = true;
      bet.cashOutMultiplier = this.currentMultiplier;
      bet.profit = profit;
      bet.cashedOutAt = new Date();
      
      // ИСПРАВЛЕНИЕ: Используем атомарную операцию
      await CrashRound.findOneAndUpdate(
        { 
          _id: this.currentRound._id,
          'bets.user': userId,
          'bets.cashedOut': false
        },
        { 
          $set: { 
            [`bets.${betIndex}.cashedOut`]: true,
            [`bets.${betIndex}.cashOutMultiplier`]: this.currentMultiplier,
            [`bets.${betIndex}.profit`]: profit,
            [`bets.${betIndex}.cashedOutAt`]: new Date()
          }
        },
        { session }
      );
      
      // Обновляем баланс пользователя
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          $inc: { 
            balance: winAmount,
            totalWon: winAmount
          }
        },
        { new: true }
      ).session(session);
      
      // Создаем транзакцию выигрыша
      const winTransaction = new Transaction({
        user: userId,
        type: 'win',
        amount: winAmount,
        description: `Вывод в краш игре при ${this.currentMultiplier.toFixed(2)}x`,
        status: 'completed',
        balanceBefore: user.balance - winAmount,
        balanceAfter: user.balance
      });
      
      await winTransaction.save({ session });
      
      await session.commitTransaction();
      
      // Эмитим событие ручного вывода
      this.emit('manualCashOut', {
        roundId: this.currentRound.roundId,
        userId,
        username: user.username || 'Игрок',
        amount: bet.amount,
        multiplier: this.currentMultiplier,
        profit: profit
      });
      
      return {
        success: true,
        multiplier: this.currentMultiplier,
        winAmount,
        profit: profit,
        balanceAfter: user.balance
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  async getCurrentGameState() {
    if (!this.currentRound) {
      return {
        status: 'no_game',
        message: 'Игра инициализируется'
      };
    }
    
    // Получаем пользователей для ставок
    const userIds = this.currentRound.bets.map(bet => bet.user);
    const users = await User.find({ _id: { $in: userIds } }).select('_id username').lean();
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user.username || 'Игрок';
      return map;
    }, {});
    
    return {
      roundId: this.currentRound.roundId,
      status: this.currentRound.status,
      currentMultiplier: this.currentMultiplier,
      serverSeedHashed: this.currentRound.serverSeedHashed,
      bets: this.currentRound.bets.map(bet => ({
        userId: bet.user,
        username: userMap[bet.user.toString()] || 'Игрок',
        amount: bet.amount,
        autoCashOut: bet.autoCashOut,
        cashedOut: bet.cashedOut,
        cashOutMultiplier: bet.cashOutMultiplier
      }))
    };
  }
  
  // Новый асинхронный метод для получения состояния игры
  async getCurrentGameStateAsync() {
    return await this.getCurrentGameState();
  }
  
  async getGameHistory(limit = 50) {
    const rounds = await CrashRound.getLastRounds(limit);
    
    return rounds.map(round => {
      // Вычисляем общую сумму ставок вручную, так как используем lean()
      const totalAmount = round.bets ? round.bets.reduce((sum, bet) => sum + bet.amount, 0) : 0;
      
      return {
        roundId: round.roundId,
        crashPoint: round.crashPoint,
        timestamp: round.createdAt,
        totalBets: round.bets ? round.bets.length : 0,
        totalAmount: totalAmount
      };
    });
  }
  
  stop() {
    this.isRunning = false;
    
    // Очищаем все таймеры
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    
    console.log('🛑 CRASH SERVICE: Сервис остановлен');
  }
  
  // Методы для управления глобальным модификатором
  
  /**
   * Установить глобальный модификатор для Crash игры
   * @param {number} modifier - Модификатор в процентах (-20 до +50)
   */
  setGlobalCrashModifier(modifier) {
    // Ограничиваем модификатор разумными пределами
    const clampedModifier = Math.max(-20, Math.min(50, modifier));
    this.globalCrashModifier = clampedModifier;
    
    console.log(`CRASH: Глобальный модификатор установлен: ${clampedModifier}%`);
    
    return {
      success: true,
      modifier: clampedModifier,
      effect: clampedModifier > 0 
        ? 'Увеличена вероятность раннего краша' 
        : clampedModifier < 0 
          ? 'Уменьшена вероятность раннего краша'
          : 'Стандартная вероятность'
    };
  }
  
  /**
   * Получить текущий глобальный модификатор
   */
  getGlobalCrashModifier() {
    return {
      modifier: this.globalCrashModifier,
      effect: this.globalCrashModifier > 0 
        ? 'Увеличена вероятность раннего краша' 
        : this.globalCrashModifier < 0 
          ? 'Уменьшена вероятность раннего краша'
          : 'Стандартная вероятность'
    };
  }
}

module.exports = new CrashService();