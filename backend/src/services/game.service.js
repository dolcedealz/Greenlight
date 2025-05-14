// backend/src/services/game.service.js
const { User, Game, Transaction } = require('../models');
const randomService = require('./random.service');
const mongoose = require('mongoose');

/**
 * Сервис для управления игровыми процессами
 */
class GameService {
  /**
   * Играть в монетку
   * @param {Object} userData - Данные пользователя
   * @param {Object} gameData - Данные игры
   * @returns {Object} - Результат игры
   */
  async playCoinFlip(userData, gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { userId, telegramId } = userData;
      const { betAmount, selectedSide, clientSeed = null } = gameData;
      
      // Найдем пользователя
      const user = await User.findOne(
        userId ? { _id: userId } : { telegramId }
      ).session(session);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (user.isBlocked) {
        throw new Error('Ваш аккаунт заблокирован');
      }
      
      // Проверяем достаточно ли средств
      if (user.balance < betAmount) {
        throw new Error('Недостаточно средств');
      }
      
      // Проверяем правильность ставки
      if (betAmount <= 0) {
        throw new Error('Сумма ставки должна быть положительной');
      }
      
      if (selectedSide !== 'heads' && selectedSide !== 'tails') {
        throw new Error('Выбрана неверная сторона монеты');
      }
      
      // Генерируем серверный сид и хешируем его для проверки честности
      const serverSeed = randomService.generateServerSeed();
      const serverSeedHashed = randomService.hashServerSeed(serverSeed);
      const nonce = randomService.generateNonce();
      
      // Определяем результат игры
      const result = randomService.flipCoin(serverSeed, clientSeed || 'default', nonce);
      
      // Определяем выигрыш/проигрыш
      const win = result === selectedSide;
      const multiplier = 1.95; // Коэффициент 1.95x (95% RTP)
      const profit = win ? betAmount * multiplier - betAmount : -betAmount;
      
      // Баланс до и после
      const balanceBefore = user.balance;
      const balanceAfter = user.balance + profit;
      
      // Обновляем баланс пользователя
      user.balance = balanceAfter;
      user.totalWagered += betAmount;
      if (win) {
        user.totalWon += betAmount * multiplier;
      }
      user.lastActivity = new Date();
      await user.save({ session });
      
      // Создаем запись об игре
      const game = new Game({
        user: user._id,
        gameType: 'coin',
        bet: betAmount,
        multiplier,
        result: {
          selectedSide,
          result,
          win
        },
        win,
        profit,
        balanceBefore,
        balanceAfter,
        clientSeed: clientSeed || 'default',
        serverSeed,
        serverSeedHashed,
        nonce,
        gameData: {
          selectedSide,
          result
        },
        status: 'completed'
      });
      
      await game.save({ session });
      
      // Создаем транзакцию для ставки
      const betTransaction = new Transaction({
        user: user._id,
        type: 'bet',
        amount: -betAmount,
        game: game._id,
        description: 'Ставка в игре "Монетка"',
        balanceBefore,
        balanceAfter: balanceBefore - betAmount
      });
      
      await betTransaction.save({ session });
      
      // Если был выигрыш, создаем транзакцию для выигрыша
      if (win) {
        const winAmount = betAmount * multiplier;
        const winTransaction = new Transaction({
          user: user._id,
          type: 'win',
          amount: winAmount,
          game: game._id,
          description: 'Выигрыш в игре "Монетка"',
          balanceBefore: balanceBefore - betAmount,
          balanceAfter
        });
        
        await winTransaction.save({ session });
      }
      
      await session.commitTransaction();
      
      // Возвращаем данные для клиента
      return {
        result,
        win,
        profit,
        multiplier,
        balanceAfter,
        serverSeedHashed, // Хеш для проверки
        clientSeed: clientSeed || 'default',
        nonce
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Начать игру в мины
   * @param {Object} userData - Данные пользователя
   * @param {Object} gameData - Данные игры
   * @returns {Object} - Результат создания игры
   */
  async playMines(userData, gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { userId, telegramId } = userData;
      const { betAmount, minesCount = 5, clientSeed = null } = gameData;
      
      // Найдем пользователя
      const user = await User.findOne(
        userId ? { _id: userId } : { telegramId }
      ).session(session);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
  
      // ДОБАВИТЬ ЭТОТ БЛОК: Завершаем все предыдущие активные игры пользователя в мины
      await Game.updateMany(
        { 
          user: user._id, 
          gameType: 'mines', 
          status: 'active' 
        },
        { 
          $set: { 
            status: 'completed',
            'result.win': false
          } 
        }
      ).session(session);
      
      // Далее оставить существующий код без изменений...
      
      // Проверяем достаточно ли средств
      if (user.balance < betAmount) {
        throw new Error('Недостаточно средств');
      }
      
      // Проверяем правильность ставки
      if (betAmount <= 0) {
        throw new Error('Сумма ставки должна быть положительной');
      }
      
      // Проверяем количество мин
      if (minesCount < 1 || minesCount > 24) {
        throw new Error('Неверное количество мин (от 1 до 24)');
      }
      
      // Генерируем серверный сид и хешируем его для проверки честности
      const serverSeed = randomService.generateServerSeed();
      const serverSeedHashed = randomService.hashServerSeed(serverSeed);
      const realClientSeed = clientSeed || 'default';
      const nonce = randomService.generateNonce();
      
      // Создаем игровое поле (5x5)
      const grid = Array(5).fill().map(() => Array(5).fill('gem'));
      const positions = [];
      
      // Заполняем массив всеми возможными позициями
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          positions.push([i, j]);
        }
      }
      
      // Используем криптографическую функцию для выбора позиций мин
      // для обеспечения честности игры
      for (let i = 0; i < minesCount; i++) {
        if (positions.length === 0) break;
        
        // Используем функцию из randomService для генерации случайного числа
        const randomValue = randomService.generateRandomNumber(
          serverSeed, 
          realClientSeed, 
          nonce + i
        );
        
        const randomIndex = Math.floor(randomValue * positions.length);
        const [row, col] = positions[randomIndex];
        
        // Устанавливаем мину
        grid[row][col] = 'mine';
        
        // Удаляем эту позицию из массива
        positions.splice(randomIndex, 1);
      }
      
      // Баланс до игры
      const balanceBefore = user.balance;
      
      // Обновляем баланс пользователя (списываем ставку)
      user.balance -= betAmount;
      user.totalWagered += betAmount;
      user.lastActivity = new Date();
      await user.save({ session });
      
      // Создаем запись об игре
      const game = new Game({
        user: user._id,
        gameType: 'mines',
        bet: betAmount,
        multiplier: 1, // Начальный множитель
        result: {
          grid, // Сохраняем игровое поле
          minesCount,
          clickedCells: [], // Ячейки, которые игрок открыл
          win: false, // Пока игра не закончена, выигрыш не определен
          cashout: false // Игрок еще не забрал выигрыш
        },
        win: false, // Пока игра не закончена
        profit: -betAmount, // Предполагаем проигрыш
        balanceBefore,
        balanceAfter: user.balance, // Уже списали ставку
        clientSeed: realClientSeed,
        serverSeed,
        serverSeedHashed,
        nonce,
        status: 'active', // Игра активна
        gameData: {
          minesCount,
          grid // Сохраняем игровое поле для проверки
        }
      });
      
      await game.save({ session });
      
      // Создаем транзакцию для ставки
      const betTransaction = new Transaction({
        user: user._id,
        type: 'bet',
        amount: -betAmount,
        game: game._id,
        description: 'Ставка в игре "Мины"',
        balanceBefore,
        balanceAfter: user.balance,
        status: 'completed' // Ставка уже списана
      });
      
      await betTransaction.save({ session });
      
      await session.commitTransaction();
      
      // Возвращаем данные для клиента
      return {
        gameId: game._id,
        betAmount,
        minesCount,
        serverSeedHashed, // Хеш для проверки
        clientSeed: realClientSeed,
        nonce,
        balanceAfter: user.balance // Возвращаем обновленный баланс
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Завершить игру в мины
   * @param {Object} userData - Данные пользователя
   * @param {Object} gameData - Данные игры
   * @returns {Object} - Результат игры
   */
  async completeMinesGame(userData, gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { userId, telegramId } = userData;
      const { gameId, row, col, cashout } = gameData;
      
      // Найдем пользователя
      const user = await User.findOne(
        userId ? { _id: userId } : { telegramId }
      ).session(session);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Найдем игру
      const game = await Game.findOne({
        _id: gameId,
        user: user._id,
        status: 'active'
      }).session(session);
      
      if (!game) {
        throw new Error('Игра не найдена или уже завершена');
      }
      
      // Получаем данные игры
      const { grid, minesCount, clickedCells } = game.result;
      
      // Если игрок хочет забрать выигрыш
      if (cashout) {
        // Рассчитываем множитель на основе открытых ячеек
        // Формула: (25 - mines) / (25 - mines - revealed) * 0.95 (5% комиссия казино)
        const revealedCount = clickedCells.length;
        const multiplier = ((25 - minesCount) / (25 - minesCount - revealedCount)) * 0.95;
        
        // Рассчитываем выигрыш
        const winAmount = game.bet * multiplier;
        const profit = winAmount - game.bet;
        
        // Обновляем игру
        game.multiplier = multiplier;
        game.result.win = true;
        game.result.cashout = true;
        game.win = true;
        game.profit = profit;
        game.balanceAfter = game.balanceBefore + profit;
        game.status = 'completed';
        
        await game.save({ session });
        
        // Обновляем баланс пользователя
        user.balance += winAmount; // Возвращаем ставку + выигрыш
        user.totalWon += winAmount;
        await user.save({ session });
        
        // Создаем транзакцию для выигрыша
        const winTransaction = new Transaction({
          user: user._id,
          type: 'win',
          amount: winAmount,
          game: game._id,
          description: `Выигрыш в игре "Мины" (x${multiplier.toFixed(2)})`,
          balanceBefore: user.balance - winAmount,
          balanceAfter: user.balance,
          status: 'completed'
        });
        
        await winTransaction.save({ session });
        
        await session.commitTransaction();
        
        // Возвращаем данные для клиента
        return {
          win: true,
          multiplier,
          profit,
          balanceAfter: user.balance, // Добавить текущий баланс
          clickedCells,
          serverSeedHashed: game.serverSeedHashed,
          clientSeed: game.clientSeed,
          nonce: game.nonce
        };
      } else {
        // Игрок кликнул по ячейке
        if (row === null || col === null) {
          throw new Error('Не указаны координаты ячейки');
        }
        
        // Проверяем, что ячейка еще не была открыта
        const cellIndex = clickedCells.findIndex(
          cell => cell[0] === row && cell[1] === col
        );
        
        if (cellIndex !== -1) {
          throw new Error('Эта ячейка уже открыта');
        }
        
        // Добавляем ячейку в список открытых
        clickedCells.push([row, col]);
        game.result.clickedCells = clickedCells;
        await game.save({ session });
        
        // Проверяем, попал ли игрок на мину
        if (grid[row][col] === 'mine') {
          // Игрок проиграл
          game.result.win = false;
          game.status = 'completed';
          
          await game.save({ session });
          
          await session.commitTransaction();
          
          // Возвращаем данные для клиента
          return {
            win: false,
            clickedCells,
            grid, // Показываем все мины
            balanceAfter: user.balance // Добавляем текущий баланс
          };
        } else {
          // Игрок не попал на мину
          
          // Проверяем, открыты ли все безопасные ячейки
          if (clickedCells.length === 25 - minesCount) {
            // Все безопасные ячейки открыты, автоматически забираем выигрыш
            // Рассчитываем множитель (максимальный)
            const multiplier = ((25 - minesCount) / 1) * 0.95;
            
            // Рассчитываем выигрыш
            const winAmount = game.bet * multiplier;
            const profit = winAmount - game.bet;
            
            // Обновляем игру
            game.multiplier = multiplier;
            game.result.win = true;
            game.result.cashout = true;
            game.win = true;
            game.profit = profit;
            game.balanceAfter = game.balanceBefore + profit;
            game.status = 'completed';
            
            await game.save({ session });
            
            // Обновляем баланс пользователя
            user.balance += winAmount; // Возвращаем ставку + выигрыш
            user.totalWon += winAmount;
            await user.save({ session });
            
            // Создаем транзакцию для выигрыша
            const winTransaction = new Transaction({
              user: user._id,
              type: 'win',
              amount: winAmount,
              game: game._id,
              description: `Выигрыш в игре "Мины" (x${multiplier.toFixed(2)})`,
              balanceBefore: user.balance - winAmount,
              balanceAfter: user.balance,
              status: 'completed'
            });
            
            await winTransaction.save({ session });
            
            await session.commitTransaction();
            
            // Возвращаем данные для клиента
            return {
              win: true,
              multiplier,
              profit,
              balanceAfter: user.balance, // Добавляем текущий баланс
              clickedCells,
              maxWin: true,
              serverSeedHashed: game.serverSeedHashed,
              clientSeed: game.clientSeed,
              nonce: game.nonce
            };
          }
          
          // Рассчитываем текущий множитель для продолжающейся игры
          const revealedCount = clickedCells.length;
          const currentMultiplier = ((25 - minesCount) / (25 - minesCount - revealedCount)) * 0.95;
          const possibleWin = game.bet * currentMultiplier;
          
          await session.commitTransaction();
          
          // Возвращаем данные для клиента с текущим множителем и возможным выигрышем
          return {
            win: null, // Игра продолжается
            clickedCells,
            currentMultiplier,
            possibleWin,
            balanceAfter: user.balance // Добавляем текущий баланс
          };
        }
      }
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Получить историю игр пользователя
   * @param {Object} userData - Данные пользователя
   * @param {Object} params - Параметры запроса
   * @returns {Array} - История игр
   */
  async getUserGames(userData, params = {}) {
    const { userId, telegramId } = userData;
    const { gameType, limit = 20, skip = 0, sort = '-createdAt' } = params;
    
    // Найдем пользователя
    const user = await User.findOne(
      userId ? { _id: userId } : { telegramId }
    );
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Строим условия поиска
    const query = { user: user._id };
    if (gameType) {
      query.gameType = gameType;
    }
    
    // Получаем игры
    const games = await Game.find(query)
      .sort(sort)
      .skip(Number(skip))
      .limit(Number(limit));
    
    // Получаем общее количество игр
    const total = await Game.countDocuments(query);
    
    return {
      games,
      total,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  /**
   * Получить статистику игр пользователя
   * @param {Object} userData - Данные пользователя
   * @returns {Object} - Статистика игр
   */
  async getUserGameStats(userData) {
    const { userId, telegramId } = userData;
    
    // Найдем пользователя
    const user = await User.findOne(
      userId ? { _id: userId } : { telegramId }
    );
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Получаем статистику
    const stats = await Game.aggregate([
      { $match: { user: user._id } },
      { $group: {
        _id: '$gameType',
        totalGames: { $sum: 1 },
        totalBet: { $sum: '$bet' },
        totalWin: { $sum: { $cond: ['$win', '$profit', 0] } },
        totalLoss: { $sum: { $cond: ['$win', 0, '$bet'] } },
        winCount: { $sum: { $cond: ['$win', 1, 0] } }
      }},
      { $project: {
        _id: 0,
        gameType: '$_id',
        totalGames: 1,
        totalBet: 1,
        totalWin: 1,
        totalLoss: 1,
        winCount: 1,
        winRate: { $divide: ['$winCount', '$totalGames'] }
      }}
    ]);
    
    // Общая статистика по всем играм
    const overall = {
      totalGames: 0,
      totalBet: 0,
      totalWin: 0,
      totalLoss: 0,
      winCount: 0,
      winRate: 0
    };
    
    stats.forEach(stat => {
      overall.totalGames += stat.totalGames;
      overall.totalBet += stat.totalBet;
      overall.totalWin += stat.totalWin;
      overall.totalLoss += stat.totalLoss;
      overall.winCount += stat.winCount;
    });
    
    if (overall.totalGames > 0) {
      overall.winRate = overall.winCount / overall.totalGames;
    }
    
    return {
      overall,
      byGameType: stats.reduce((acc, stat) => {
        acc[stat.gameType] = stat;
        return acc;
      }, {})
    };
  }
}

module.exports = new GameService();