// backend/src/services/game.service.js
const { User, Game, Transaction } = require('../models');
const randomService = require('./random.service');
// Импортируем новый сервис для управления шансами
const oddsService = require('./odds.service');
const referralService = require('./referral.service');
const mongoose = require('mongoose');

// Предварительно рассчитанные таблицы коэффициентов для каждого количества мин
const payoutTables = {
  3: {
    1: 1.13, 2: 1.29, 3: 1.48, 4: 1.71, 5: 2.00, 6: 2.35, 7: 2.79, 8: 3.35, 9: 4.07, 10: 5.00,
    11: 6.26, 12: 7.96, 13: 10.35, 14: 13.80, 15: 18.98, 16: 27.11, 17: 40.66, 18: 65.06,
    19: 113.85, 20: 227.70, 21: 569.25, 22: 2277.00
  },
  5: {
    1: 1.24, 2: 1.56, 3: 2.00, 4: 2.58, 5: 3.39, 6: 4.52, 7: 6.14, 8: 8.50, 9: 12.04, 10: 17.52,
    11: 26.27, 12: 40.87, 13: 66.41, 14: 113.85, 15: 208.73, 16: 417.45, 17: 939.26, 18: 2504.70,
    19: 8766.45, 20: 52598.70
  },
  7: {
    1: 1.38, 2: 1.94, 3: 2.79, 4: 4.09, 5: 6.14, 6: 9.44, 7: 14.95, 8: 24.47, 9: 41.60, 10: 73.95,
    11: 138.66, 12: 277.33, 13: 600.88, 14: 1442.10, 15: 3965.78, 16: 13219.25, 17: 59486.63, 18: 475893.00
  },
  9: {
    1: 1.55, 2: 2.48, 3: 4.07, 4: 6.88, 5: 12.04, 6: 21.89, 7: 41.60, 8: 83.20, 9: 176.80, 10: 404.10,
    11: 1010.26, 12: 2828.73, 13: 9193.39, 14: 36773.55, 15: 202254.53, 16: 2022545.25
  },
  12: {
    1: 1.90, 2: 3.81, 3: 7.96, 4: 17.52, 5: 40.87, 6: 102.17, 7: 277.33, 8: 831.98, 9: 2828.73, 10: 11314.94,
    11: 56574.69, 12: 396022.85, 13: 5148297.00
  },
  15: {
    1: 2.48, 2: 6.60, 3: 18.98, 4: 59.64, 5: 208.73, 6: 834.90, 7: 3965.78, 8: 23794.65, 9: 202254.53, 10: 3236072.40
  },
  18: {
    1: 3.54, 2: 14.14, 3: 65.06, 4: 357.81, 5: 2504.70, 6: 25047.00, 7: 475893.00
  },
  21: {
    1: 6.19, 2: 49.50, 3: 569.25, 4: 12523.50
  },
  23: {
    1: 12.38, 2: 297.00
  }
};

/**
 * Сервис для управления игровыми процессами
 */
class GameService {
  /**
   * Играть в монетку - ПОЛНОСТЬЮ ИЗМЕНЕННЫЙ МЕТОД
   * @param {Object} userData - Данные пользователя
   * @param {Object} gameData - Данные игры
   * @returns {Object} - Результат игры
   */
  async playCoinFlip(userData, gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { userId, telegramId } = userData;
      const { betAmount, selectedSide } = gameData;
      
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
      
      // Получаем шанс выигрыша для пользователя
      const winChance = await oddsService.getUserWinChance(user, 'coin');
      
      // Генерируем случайное число от 0 до 1
      const randomValue = Math.random();
      
      // Определяем результат игры
      const win = randomValue < winChance;
      
      // Если игрок выиграл, результат совпадает с его выбором
      // Если проиграл - результат противоположный выбору
      const result = win ? selectedSide : (selectedSide === 'heads' ? 'tails' : 'heads');
      
      // Определяем выигрыш/проигрыш с множителем x2
      const multiplier = 2.0;
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
      
      // Создаем запись об игре (без seed и прочего)
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
      
      // Обновляем финансовую статистику
      const financeService = require('./casino-finance.service');
      await financeService.updateAfterGame({
        gameType: 'coin',
        bet: betAmount,
        profit: profit,
        win: win
      });
      
      // Обрабатываем реферальную комиссию если игрок проиграл
      if (!win) {
        try {
          await referralService.processGameLoss({
            userId: user._id,
            gameId: game._id,
            gameType: 'coin',
            bet: betAmount,
            profit: profit
          });
        } catch (refError) {
          console.error('GAME: Ошибка обработки реферальной комиссии:', refError);
          // Не прерываем игру из-за ошибки в реферальной системе
        }
      }
      
      // Возвращаем данные для клиента (без seed и прочего)
      return {
        result,
        win,
        profit,
        multiplier,
        balanceAfter
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
/**
 * Играть в слоты (УЛУЧШЕННЫЕ КОЭФФИЦИЕНТЫ для 4x4 - ТОЛЬКО горизонтальные и диагональные линии)
 * @param {Object} userData - Данные пользователя
 * @param {Object} gameData - Данные игры
 * @returns {Object} - Результат игры
 */
async playSlots(userData, gameData) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { userId, telegramId } = userData;
    const { betAmount } = gameData;
    
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
    
    if (betAmount <= 0) {
      throw new Error('Сумма ставки должна быть положительной');
    }
    
    const SLOT_SYMBOLS = [
      { symbol: 'cherry', weight: 25, payout: 4 },    // было 2, стало 4
      { symbol: 'lemon', weight: 20, payout: 6 },     // было 3, стало 6
      { symbol: 'persik', weight: 15, payout: 8 },    // было orange, теперь persik
      { symbol: 'grape', weight: 12, payout: 12 },    // было 5, стало 12
      { symbol: 'bell', weight: 8, payout: 18 },      // было 8, стало 18
      { symbol: 'diamond', weight: 5, payout: 30 },   // было 15, стало 30
      { symbol: 'star', weight: 3, payout: 50 },      // было 25, стало 50
      { symbol: 'jackpot', weight: 2, payout: 100 }   // было 50, стало 100
    ];
    
    // Функция генерации символа
    const generateSymbol = () => {
      const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (const symbolData of SLOT_SYMBOLS) {
        random -= symbolData.weight;
        if (random <= 0) {
          return symbolData;
        }
      }
      
      return SLOT_SYMBOLS[0];
    };
    
    // Генерируем барабаны в правильном формате [колонка][строка]
    const reels = [];
    for (let col = 0; col < 4; col++) {
      const column = [];
      for (let row = 0; row < 4; row++) {
        column.push(generateSymbol().symbol);
      }
      reels.push(column);
    }
    
    console.log('СЛОТЫ: Сгенерированные барабаны:', JSON.stringify(reels, null, 2));
    
    // Проверяем выигрышные линии ТОЛЬКО горизонтальные и диагональные (БЕЗ вертикальных)
    const winningLines = [];
    const winningSymbols = [];
    let totalMultiplier = 0;
    
    // Функция для добавления выигрышной линии
    const addWinningLine = (positions, symbol, consecutiveCount) => {
      const symbolData = SLOT_SYMBOLS.find(s => s.symbol === symbol);
      if (!symbolData) return;
      
      winningLines.push(positions);
      if (!winningSymbols.includes(symbol)) {
        winningSymbols.push(symbol);
      }
      
      if (consecutiveCount === 3) {
        totalMultiplier += symbolData.payout / 2;
        console.log(`СЛОТЫ: Выигрышная линия 3 в ряд (${symbol}): +${symbolData.payout / 2}x`);
      } else if (consecutiveCount === 4) {
        totalMultiplier += symbolData.payout;
        console.log(`СЛОТЫ: Выигрышная линия 4 в ряд (${symbol}): +${symbolData.payout}x`);
      }
    };
    
    // ГОРИЗОНТАЛЬНЫЕ ЛИНИИ (строки) - ОСТАВЛЯЕМ
    for (let row = 0; row < 4; row++) {
      const firstSymbol = reels[0][row];
      let consecutiveCount = 1;
      const positions = [`0-${row}`];
      
      for (let col = 1; col < 4; col++) {
        if (reels[col][row] === firstSymbol) {
          consecutiveCount++;
          positions.push(`${col}-${row}`);
        } else {
          break;
        }
      }
      
      if (consecutiveCount >= 3) {
        addWinningLine(positions, firstSymbol, consecutiveCount);
      }
    }
    
    // ВЕРТИКАЛЬНЫЕ ЛИНИИ (колонки) - УБИРАЕМ ПОЛНОСТЬЮ
    // Этот блок кода удален
    
    // ГЛАВНАЯ ДИАГОНАЛЬ (сверху-слева вниз-вправо) - ОСТАВЛЯЕМ
    const diagonal1Symbol = reels[0][0];
    let diagonal1Count = 1;
    const diagonal1Positions = ['0-0'];
    
    for (let i = 1; i < 4; i++) {
      if (reels[i][i] === diagonal1Symbol) {
        diagonal1Count++;
        diagonal1Positions.push(`${i}-${i}`);
      } else {
        break;
      }
    }
    
    if (diagonal1Count >= 3) {
      addWinningLine(diagonal1Positions, diagonal1Symbol, diagonal1Count);
    }
    
    // ПОБОЧНАЯ ДИАГОНАЛЬ (сверху-справа вниз-влево) - ОСТАВЛЯЕМ
    const diagonal2Symbol = reels[0][3];
    let diagonal2Count = 1;
    const diagonal2Positions = ['0-3'];
    
    for (let i = 1; i < 4; i++) {
      if (reels[i][3 - i] === diagonal2Symbol) {
        diagonal2Count++;
        diagonal2Positions.push(`${i}-${3 - i}`);
      } else {
        break;
      }
    }
    
    if (diagonal2Count >= 3) {
      addWinningLine(diagonal2Positions, diagonal2Symbol, diagonal2Count);
    }
    
    console.log('СЛОТЫ: Выигрышные линии (только горизонтальные и диагональные):', JSON.stringify(winningLines, null, 2));
    console.log('СЛОТЫ: Общий множитель:', totalMultiplier);
    
    // Определяем выигрыш
    const win = totalMultiplier > 0;
    const winAmount = win ? betAmount * totalMultiplier : 0;
    const profit = win ? winAmount - betAmount : -betAmount;
    
    // Баланс до и после
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore + profit;
    
    // Обновляем баланс пользователя
    user.balance = balanceAfter;
    user.totalWagered += betAmount;
    if (win) {
      user.totalWon += winAmount;
    }
    user.lastActivity = new Date();
    await user.save({ session });
    
    // Создаем запись об игре
    const game = new Game({
      user: user._id,
      gameType: 'slots',
      bet: betAmount,
      multiplier: totalMultiplier || 0,
      result: {
        reels,
        winningLines,
        winningSymbols,
        totalMultiplier,
        win
      },
      win,
      profit,
      balanceBefore,
      balanceAfter,
      status: 'completed'
    });
    
    await game.save({ session });
    
    // Создаем транзакцию для ставки
    const betTransaction = new Transaction({
      user: user._id,
      type: 'bet',
      amount: -betAmount,
      game: game._id,
      description: 'Ставка в игре "Слоты"',
      balanceBefore,
      balanceAfter: balanceBefore - betAmount
    });
    
    await betTransaction.save({ session });
    
    // Если был выигрыш, создаем транзакцию для выигрыша
    if (win) {
      const winTransaction = new Transaction({
        user: user._id,
        type: 'win',
        amount: winAmount,
        game: game._id,
        description: `Выигрыш в игре "Слоты" (x${totalMultiplier.toFixed(2)})`,
        balanceBefore: balanceBefore - betAmount,
        balanceAfter
      });
      
      await winTransaction.save({ session });
    }
    
    await session.commitTransaction();
    
    // Обновляем финансовую статистику
    const financeService = require('./casino-finance.service');
    await financeService.updateAfterGame({
      gameType: 'slots',
      bet: betAmount,
      profit: profit,
      win: win
    });
    
    // Обрабатываем реферальную комиссию если игрок проиграл
    if (!win) {
      try {
        await referralService.processGameLoss({
          userId: user._id,
          gameId: game._id,
          gameType: 'slots',
          bet: betAmount,
          profit: profit
        });
      } catch (refError) {
        console.error('GAME: Ошибка обработки реферальной комиссии:', refError);
      }
    }
    
    console.log('СЛОТЫ: Финальный результат:', {
      reels,
      winningLines,
      winningSymbols,
      win,
      profit,
      multiplier: totalMultiplier,
      balanceAfter
    });
    
    // Возвращаем данные для клиента
    return {
      reels,
      winningLines,
      winningSymbols,
      win,
      profit,
      multiplier: totalMultiplier,
      balanceAfter
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
      
      // Валидация входных данных
      if (betAmount <= 0) {
        throw new Error('Сумма ставки должна быть положительной');
      }
      
      // Проверяем, что количество мин из разрешенного списка
      const allowedMinesCount = [3, 5, 7, 9, 12, 15, 18, 21, 23];
      if (!allowedMinesCount.includes(Number(minesCount))) {
        throw new Error('Неверное количество мин. Разрешенные значения: 3, 5, 7, 9, 12, 15, 18, 21, 23');
      }
      
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
      
      // Завершаем все предыдущие активные игры пользователя в мины
      await Game.updateMany(
        { 
          user: user._id, 
          gameType: 'mines', 
          status: 'active' 
        },
        { 
          $set: { 
            status: 'completed',
            win: false,
            'result.win': false
          } 
        }
      ).session(session);
      
      // Генерируем серверный сид и хешируем его для проверки честности
      const serverSeed = randomService.generateServerSeed();
      const serverSeedHashed = randomService.hashServerSeed(serverSeed);
      const realClientSeed = clientSeed || 'default';
      const nonce = randomService.generateNonce();
      
      // Создаем игровое поле 5x5
      const grid = Array(5).fill().map(() => Array(5).fill('gem'));
      
      // Генерируем позиции мин
      const minePositions = [];
      const allPositions = [];
      
      // Заполняем массив всеми возможными позициями
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          allPositions.push([i, j]);
        }
      }
      
      // Перемешиваем позиции с использованием криптографически надежного рандома
      for (let i = allPositions.length - 1; i > 0; i--) {
        const randomValue = randomService.generateRandomNumber(
          serverSeed, 
          realClientSeed, 
          nonce + i
        );
        const j = Math.floor(randomValue * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
      }
      
      // Выбираем первые N позиций для мин
      for (let i = 0; i < minesCount; i++) {
        const [row, col] = allPositions[i];
        grid[row][col] = 'mine';
        minePositions.push([row, col]);
      }
      
      // Баланс до игры и после списания ставки
      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - betAmount;
      
      // Обновляем баланс пользователя (списываем ставку)
      user.balance = balanceAfter;
      user.totalWagered += betAmount;
      user.lastActivity = new Date();
      await user.save({ session });
      
      // Получаем начальный множитель из таблицы
      const initialMultiplier = payoutTables[minesCount][1] || 0.95;
      
      // Создаем запись об игре
      const game = new Game({
        user: user._id,
        gameType: 'mines',
        bet: betAmount,
        multiplier: initialMultiplier, // Используем значение из таблицы
        result: {
          grid,
          minesCount,
          minePositions,
          clickedCells: [],
          win: null,  // null = игра в процессе
          cashout: false
        },
        win: null,
        profit: -betAmount, // Изначально списываем ставку
        balanceBefore,
        balanceAfter,
        clientSeed: realClientSeed,
        serverSeed,
        serverSeedHashed,
        nonce,
        status: 'active',
        gameData: {
          minesCount,
          safeTotal: 25 - minesCount
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
        balanceAfter,
        status: 'completed'
      });
      
      await betTransaction.save({ session });
      
      await session.commitTransaction();
      
      // Возвращаем данные для клиента (без раскрытия позиций мин)
      return {
        gameId: game._id,
        betAmount,
        minesCount,
        serverSeedHashed,
        clientSeed: realClientSeed,
        nonce,
        balanceAfter
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Завершить игру в мины (открыть ячейку или забрать выигрыш)
   * @param {Object} userData - Данные пользователя
   * @param {Object} gameData - Данные игры
   * @returns {Object} - Результат хода
   */
  async completeMinesGame(userData, gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { userId, telegramId } = userData;
      const { gameId, row, col, cashout } = gameData;
      
      // Находим пользователя
      const user = await User.findOne(
        userId ? { _id: userId } : { telegramId }
      ).session(session);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Находим игру с обязательной проекцией всех полей
      const game = await Game.findOne({
        _id: gameId,
        user: user._id,
        status: 'active'
      }).session(session);
      
      if (!game) {
        throw new Error('Игра не найдена или уже завершена');
      }
      
      console.log('ОТЛАДКА ТЕКУЩЕГО СОСТОЯНИЯ ИГРЫ:', 
                  `ID=${gameId}`, 
                  `clickedCells=${JSON.stringify(game.result.clickedCells)}`,
                  `minesCount=${game.result.minesCount}`);
      
      // Важные константы для расчетов
      const minesCount = game.result.minesCount;
      const safeTotal = 25 - minesCount;
      
      // НОВЫЙ ПОДХОД: гарантируем, что clickedCells всегда массив
      // и преобразуем его к стандартному формату
      let clickedCells = [];
      if (Array.isArray(game.result.clickedCells)) {
        // Создаем глубокую копию массива
        clickedCells = JSON.parse(JSON.stringify(game.result.clickedCells));
      }
      
      console.log('ОТЛАДКА ТЕКУЩИХ КЛИКОВ:', JSON.stringify(clickedCells));
      
      // Если игрок хочет забрать выигрыш
      if (cashout) {
        // Рассчитываем множитель
        const revealedCount = clickedCells.length;
        
        if (revealedCount === 0) {
          throw new Error('Необходимо открыть хотя бы одну ячейку');
        }
        
        const remainingSafe = safeTotal - revealedCount;
        
        if (remainingSafe <= 0) {
          throw new Error('Все безопасные ячейки уже открыты');
        }
        
        // Получаем множитель из предрассчитанной таблицы
        const multiplier = payoutTables[minesCount][revealedCount];
        
        if (!multiplier) {
          throw new Error('Ошибка расчета множителя');
        }
        
        // Рассчитываем выигрыш
        const winAmount = game.bet * multiplier;
        const profit = winAmount - game.bet;
        
        console.log(`КЕШАУТ: ставка=${game.bet}, множитель=${multiplier}, выигрыш=${winAmount}, прибыль=${profit}`);
        
        // Используем атомарное обновление с операторами MongoDB
        await Game.updateOne(
          { _id: gameId },
          { 
            $set: {
              multiplier: multiplier,
              'result.win': true,
              'result.cashout': true,
              win: true,
              profit: profit,
              balanceAfter: game.balanceBefore + profit,
              status: 'completed'
            }
          }
        ).session(session);
        
        // Обновляем баланс пользователя атомарно
        await User.updateOne(
          { _id: user._id },
          { 
            $inc: { 
              balance: winAmount,
              totalWon: winAmount
            },
            $set: { lastActivity: new Date() }
          }
        ).session(session);
        
        // Создаем транзакцию для выигрыша
        const winTransaction = new Transaction({
          user: user._id,
          type: 'win',
          amount: winAmount,
          game: game._id,
          description: `Выигрыш в игре "Мины" (x${multiplier.toFixed(2)})`,
          balanceBefore: user.balance,
          balanceAfter: user.balance + winAmount,
          status: 'completed'
        });
        
        await winTransaction.save({ session });
        
        // Синхронизируем переменные с обновленными значениями
        user.balance += winAmount;
        
        await session.commitTransaction();
        
        // Обновляем финансовую статистику
        const financeService = require('./casino-finance.service');
        await financeService.updateAfterGame({
          gameType: 'mines',
          bet: game.bet,
          profit: profit,
          win: true
        });
        
        // Возвращаем данные для клиента
        return {
          win: true,
          multiplier,
          profit,
          balanceAfter: user.balance,
          clickedCells,
          grid: game.result.grid, // Добавляем сетку в результаты кешаута
          serverSeedHashed: game.serverSeedHashed,
          clientSeed: game.clientSeed,
          nonce: game.nonce
        };
      } else {
        // Игрок кликнул по ячейке
        if (row === null || col === null || row === undefined || col === undefined) {
          throw new Error('Не указаны координаты ячейки');
        }
        
        // Проверяем, что координаты в допустимых пределах
        if (row < 0 || row > 4 || col < 0 || col > 4) {
          throw new Error('Некорректные координаты ячейки');
        }
        
        // Проверяем, что ячейка еще не была открыта
        const cellAlreadyClicked = clickedCells.some(
          cell => cell[0] === row && cell[1] === col
        );
        
        if (cellAlreadyClicked) {
          throw new Error('Эта ячейка уже открыта');
        }
        
        // Получаем игровое поле и позиции мин
        const grid = game.result.grid;
        
        // Проверяем, попал ли игрок на мину
        if (grid[row][col] === 'mine') {
          // НОВЫЙ ПОДХОД: Добавляем ячейку в список открытых
          // Используем оператор $push для атомарного обновления массива
          await Game.updateOne(
            { _id: gameId },
            { 
              $push: { 'result.clickedCells': [row, col] },
              $set: {
                'result.win': false,
                win: false,
                status: 'completed'
              }
            }
          ).session(session);
          
          await session.commitTransaction();
          
          // Обновляем финансовую статистику
          const financeService = require('./casino-finance.service');
          await financeService.updateAfterGame({
            gameType: 'mines',
            bet: game.bet,
            profit: -game.bet,
            win: false
          });
          
          // Обрабатываем реферальную комиссию
          try {
            await referralService.processGameLoss({
              userId: user._id,
              gameId: game._id,
              gameType: 'mines',
              bet: game.bet,
              profit: -game.bet
            });
          } catch (refError) {
            console.error('GAME: Ошибка обработки реферальной комиссии:', refError);
          }
          
          // Добавляем новую ячейку в локальный массив для ответа
          clickedCells.push([row, col]);
          
          // Возвращаем данные для клиента
          return {
            win: false,
            clickedCells,
            grid,
            balanceAfter: user.balance
          };
        } else {
          // Игрок открыл безопасную ячейку
          // Добавляем ячейку во временный массив для расчетов
          clickedCells.push([row, col]);
          
          const revealedCount = clickedCells.length;
          const remainingSafe = safeTotal - revealedCount;
          
          // Проверка на открытие всех безопасных ячеек
          const allSafeCellsRevealed = revealedCount === safeTotal;
          
          if (allSafeCellsRevealed) {
            // Максимальный выигрыш - все безопасные ячейки открыты
            // Получаем максимальный множитель из таблицы
            const maxMultiplier = payoutTables[minesCount][safeTotal - 1];
            
            if (!maxMultiplier) {
              throw new Error('Ошибка расчета максимального множителя');
            }
            
            const winAmount = game.bet * maxMultiplier;
            const profit = winAmount - game.bet;
            
            // НОВЫЙ ПОДХОД: Атомарное обновление с $push и $set
            await Game.updateOne(
              { _id: gameId },
              { 
                $push: { 'result.clickedCells': [row, col] },
                $set: {
                  multiplier: maxMultiplier,
                  'result.win': true,
                  'result.cashout': true,
                  win: true,
                  profit: profit,
                  balanceAfter: game.balanceBefore + profit,
                  status: 'completed'
                }
              }
            ).session(session);
            
            // Обновляем баланс пользователя атомарно
            await User.updateOne(
              { _id: user._id },
              { 
                $inc: { 
                  balance: winAmount,
                  totalWon: winAmount
                },
                $set: { lastActivity: new Date() }
              }
            ).session(session);
            
            // Создаем транзакцию для выигрыша
            const winTransaction = new Transaction({
              user: user._id,
              type: 'win',
              amount: winAmount,
              game: game._id,
              description: `Максимальный выигрыш в игре "Мины" (x${maxMultiplier.toFixed(2)})`,
              balanceBefore: user.balance,
              balanceAfter: user.balance + winAmount,
              status: 'completed'
            });
            
            await winTransaction.save({ session });
            
            // Синхронизируем переменные
            user.balance += winAmount;
            
            await session.commitTransaction();
            
            // Обновляем финансовую статистику
            const financeService = require('./casino-finance.service');
            await financeService.updateAfterGame({
              gameType: 'mines',
              bet: game.bet,
              profit: profit,
              win: true
            });
            
            // Возвращаем данные для клиента
            return {
              win: true,
              multiplier: maxMultiplier,
              profit,
              balanceAfter: user.balance,
              clickedCells,
              grid, // Добавляем сетку
              maxWin: true,
              serverSeedHashed: game.serverSeedHashed,
              clientSeed: game.clientSeed,
              nonce: game.nonce
            };
          } else {
            // Игра продолжается
            
            // Получаем множитель из таблицы для текущего количества открытых ячеек
            const multiplier = payoutTables[minesCount][revealedCount];
            
            if (!multiplier) {
              throw new Error('Ошибка расчета множителя');
            }
            
            console.log(`ОТЛАДКА МНОЖИТЕЛЯ: minesCount=${minesCount}, revealedCount=${revealedCount}, multiplier=${multiplier}`);
            
            // НОВЫЙ ПОДХОД: Используем $push для добавления в массив и $set для обновления множителя
            await Game.updateOne(
              { _id: gameId },
              { 
                $push: { 'result.clickedCells': [row, col] },
                $set: { multiplier: multiplier }
              }
            ).session(session);
            
            await session.commitTransaction();
            
            // Возвращаем данные для клиента
            return {
              win: null, // null означает, что игра продолжается
              clickedCells, // Возвращаем ВСЕ открытые ячейки
              grid, // Добавляем сетку - САМОЕ ВАЖНОЕ ИЗМЕНЕНИЕ
              currentMultiplier: multiplier,
              possibleWin: game.bet * multiplier,
              balanceAfter: user.balance
            };
          }
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

