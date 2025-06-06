// backend/src/services/game.service.js
const { User, Game, Transaction } = require('../models');
const randomService = require('./random.service');
// Импортируем новый сервис для управления шансами
const oddsService = require('./odds.service');
const referralService = require('./referral.service');
const mongoose = require('mongoose');


// Предварительно рассчитанные таблицы коэффициентов для каждого количества мин
// ОБНОВЛЕНО: уменьшены коэффициенты согласно требованиям:
// - 3, 5, 7 мин: все коэффициенты уменьшены на 10%
// - 9, 12, 15, 18 мин: все коэффициенты уменьшены на 15%
// - 21, 23 мины: начальные коэффициенты уменьшены на 15%
const payoutTables = {
  // 3 мины: уменьшено на 10%
  3: {
    1: 1.02, 2: 1.16, 3: 1.33, 4: 1.54, 5: 1.80, 6: 2.12, 7: 2.51, 8: 3.02, 9: 3.66, 10: 4.50,
    11: 5.63, 12: 7.16, 13: 9.32, 14: 12.42, 15: 17.08, 16: 24.40, 17: 36.59, 18: 58.55,
    19: 102.47, 20: 204.93, 21: 512.33, 22: 2049.30
  },
  // 5 мин: уменьшено на 10%
  5: {
    1: 1.12, 2: 1.40, 3: 1.80, 4: 2.32, 5: 3.05, 6: 4.07, 7: 5.53, 8: 7.65, 9: 10.84, 10: 15.77,
    11: 23.64, 12: 36.78, 13: 59.77, 14: 102.47, 15: 187.86, 16: 375.71, 17: 845.33, 18: 2254.23,
    19: 7889.81, 20: 47338.83
  },
  // 7 мин: уменьшено на 10%
  7: {
    1: 1.24, 2: 1.75, 3: 2.51, 4: 3.68, 5: 5.53, 6: 8.50, 7: 13.46, 8: 22.02, 9: 37.44, 10: 66.56,
    11: 124.79, 12: 249.60, 13: 540.79, 14: 1297.89, 15: 3569.20, 16: 11897.33, 17: 53537.97, 18: 428303.70
  },
  // 9 мин: уменьшено на 15%
  9: {
    1: 1.32, 2: 2.11, 3: 3.46, 4: 5.85, 5: 10.23, 6: 18.61, 7: 35.36, 8: 70.72, 9: 150.28, 10: 343.49,
    11: 858.72, 12: 2404.42, 13: 7814.38, 14: 31257.52, 15: 171916.35, 16: 1719163.46
  },
  // 12 мин: уменьшено на 15%
  12: {
    1: 1.62, 2: 3.24, 3: 6.77, 4: 14.89, 5: 34.74, 6: 86.84, 7: 235.73, 8: 707.18, 9: 2404.42, 10: 9617.70,
    11: 48088.49, 12: 336619.42, 13: 4376052.45
  },
  // 15 мин: уменьшено на 15%
  15: {
    1: 2.11, 2: 5.61, 3: 16.13, 4: 50.69, 5: 177.42, 6: 709.67, 7: 3370.91, 8: 20225.45, 9: 171916.35, 10: 2750661.54
  },
  // 18 мин: уменьшено на 15%
  18: {
    1: 3.01, 2: 12.02, 3: 55.30, 4: 304.14, 5: 2129.00, 6: 21289.95, 7: 404509.05
  },
  // 21 мина: начальные коэффициенты уменьшены на 15%
  21: {
    1: 5.26, 2: 42.08, 3: 569.25, 4: 12523.50
  },
  // 23 мины: начальные коэффициенты уменьшены на 15%
  23: {
    1: 10.52, 2: 297.00
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
 * Играть в слоты (ОБНОВЛЕННЫЕ КОЭФФИЦИЕНТЫ - дополнительно урезаны на 20%)
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
    
    // ОБНОВЛЕННЫЕ КОЭФФИЦИЕНТЫ (дополнительно урезаны на 20% кроме jackpot)
    const SLOT_SYMBOLS = [
      { symbol: 'cherry', weight: 25, payout: 1.6 },    // было 2, стало 1.6 (-20%)
      { symbol: 'lemon', weight: 20, payout: 2.4 },     // было 3, стало 2.4 (-20%)
      { symbol: 'persik', weight: 15, payout: 3.2 },    // было 4, стало 3.2 (-20%)
      { symbol: 'grape', weight: 12, payout: 4.8 },     // было 6, стало 4.8 (-20%)
      { symbol: 'bell', weight: 8, payout: 7.2 },       // было 9, стало 7.2 (-20%)
      { symbol: 'diamond', weight: 5, payout: 12 },     // было 15, стало 12 (-20%)
      { symbol: 'star', weight: 3, payout: 20 },        // было 25, стало 20 (-20%)
      { symbol: 'jackpot', weight: 2, payout: 50 }      // остается 50 (максвин)
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
    
    // Получаем RTP для пользователя
    const userRTP = await oddsService.getSlotsRTP(user);
    const shouldWin = await oddsService.shouldSlotsWin(user);
    
    console.log(`СЛОТЫ: RTP для пользователя ${user.username || user.telegramId}: ${userRTP}, выигрыш: ${shouldWin}`);

    // Генерируем барабаны в правильном формате [колонка][строка]
    const reels = [];
    
    // Если пользователь должен выиграть, пытаемся создать выигрышную комбинацию
    if (shouldWin && Math.random() < 0.8) { // 80% шанс форсированного выигрыша
      // Выбираем случайный символ для выигрышной линии
      const winSymbol = generateSymbol();
      const lineType = Math.random();
      
      // Генерируем базовые барабаны
      for (let col = 0; col < 4; col++) {
        const column = [];
        for (let row = 0; row < 4; row++) {
          column.push(generateSymbol().symbol);
        }
        reels.push(column);
      }
      
      // Создаем выигрышную линию
      if (lineType < 0.6) { // 60% - горизонтальная линия
        const row = Math.floor(Math.random() * 4);
        const length = Math.random() < 0.5 ? 3 : 4; // 50/50 для 3 или 4 в ряд
        for (let col = 0; col < length; col++) {
          reels[col][row] = winSymbol.symbol;
        }
      } else { // 40% - диагональная линия
        const length = Math.random() < 0.5 ? 3 : 4;
        if (Math.random() < 0.5) { // главная диагональ
          for (let i = 0; i < length; i++) {
            reels[i][i] = winSymbol.symbol;
          }
        } else { // побочная диагональ
          for (let i = 0; i < length; i++) {
            reels[i][3 - i] = winSymbol.symbol;
          }
        }
      }
    } else {
      // Обычная генерация
      for (let col = 0; col < 4; col++) {
        const column = [];
        for (let row = 0; row < 4; row++) {
          column.push(generateSymbol().symbol);
        }
        reels.push(column);
      }
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
   * Генерирует отображаемую сетку с учетом модификаторов и игрового состояния
   * @param {Array} realGrid - Реальная игровая сетка
   * @param {Number} realMinesCount - Реальное количество мин на поле
   * @param {Number} requestedMinesCount - Запрошенное пользователем количество мин
   * @param {Array} clickedCells - Открытые ячейки
   * @param {Boolean} isGameOver - Завершена ли игра (для показа всех мин)
   * @returns {Array} - Модифицированная сетка для отображения
   */
  generateDisplayGrid(realGrid, realMinesCount, requestedMinesCount, clickedCells = [], isGameOver = false) {
    console.log(`ОТЛАДКА СЕТКИ: real=${realMinesCount}, requested=${requestedMinesCount}, gameOver=${isGameOver}`);
    
    const displayGrid = JSON.parse(JSON.stringify(realGrid)); // Клонируем реальную сетку
    
    // Если игра завершена, создаем сетку с запрошенным количеством мин
    if (isGameOver) {
      // Сначала очищаем все мины
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (displayGrid[i][j] === 'mine') {
            displayGrid[i][j] = 'gem';
          }
        }
      }
      
      // Находим клетки, которые НЕ были открыты игроком
      const availableForMines = [];
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const isClicked = clickedCells.some(cell => cell[0] === i && cell[1] === j);
          if (!isClicked) {
            availableForMines.push([i, j]);
          }
        }
      }
      
      // Случайно размещаем запрошенное количество мин в неоткрытых ячейках
      const shuffledCells = [...availableForMines].sort(() => Math.random() - 0.5);
      const minesToPlace = Math.min(requestedMinesCount, shuffledCells.length);
      
      for (let i = 0; i < minesToPlace; i++) {
        const [row, col] = shuffledCells[i];
        displayGrid[row][col] = 'mine';
      }
      
      console.log(`ОТЛАДКА СЕТКИ: Размещено ${minesToPlace} мин из ${requestedMinesCount} запрошенных`);
      return displayGrid;
    }
    
    // Логика для активной игры - скрываем модификаторы
    // Если реальных мин больше, чем запрошено, скрываем лишние
    if (realMinesCount > requestedMinesCount) {
      const minesToHide = realMinesCount - requestedMinesCount;
      let hidden = 0;
      
      for (let i = 0; i < 5 && hidden < minesToHide; i++) {
        for (let j = 0; j < 5 && hidden < minesToHide; j++) {
          // Скрываем мины, которые не были кликнуты
          if (displayGrid[i][j] === 'mine' && !clickedCells.some(cell => cell[0] === i && cell[1] === j)) {
            displayGrid[i][j] = 'gem';
            hidden++;
          }
        }
      }
    }
    // Если реальных мин меньше, добавляем фейковые
    else if (realMinesCount < requestedMinesCount) {
      const minesToAdd = requestedMinesCount - realMinesCount;
      let added = 0;
      
      // Собираем свободные ячейки
      const freeCells = [];
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (displayGrid[i][j] === 'gem' && !clickedCells.some(cell => cell[0] === i && cell[1] === j)) {
            freeCells.push([i, j]);
          }
        }
      }
      
      // Случайно добавляем фейковые мины
      while (added < minesToAdd && freeCells.length > 0) {
        const randomIndex = Math.floor(Math.random() * freeCells.length);
        const [i, j] = freeCells.splice(randomIndex, 1)[0];
        displayGrid[i][j] = 'mine';
        added++;
      }
    }
    
    return displayGrid;
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
      
      // Проверяем, что запрошенное количество мин допустимо для выплат
      const allowedMinesForPayout = [3, 5, 7, 9, 12, 15, 18, 21, 23];
      if (!allowedMinesForPayout.includes(minesCount)) {
        throw new Error(`Недопустимое количество мин: ${minesCount}. Разрешены: ${allowedMinesForPayout.join(', ')}`);
      }
      
      // ИНТЕГРАЦИЯ МОДИФИКАТОРА: Получаем модифицированное количество мин для поля
      const modifiedMinesCount = await oddsService.getModifiedMinesCount(user, minesCount);
      
      // ЛОГИКА: 
      // - На поле размещается модифицированное количество мин (влияет на сложность)
      // - Выплаты всегда по выбранному игроком количеству (справедливость)
      const actualMinesOnField = Math.max(1, Math.min(24, modifiedMinesCount)); // Ограничиваем 1-24
      const payoutMinesCount = minesCount; // Выплаты по выбранному количеству
      
      console.log(`МИНЫ: Игрок выбрал: ${minesCount} мин, на поле: ${actualMinesOnField}, выплаты за: ${payoutMinesCount}`);
      
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
      
      // Размещаем выбранное игроком количество мин на поле
      for (let i = 0; i < actualMinesOnField; i++) {
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
      
      // Получаем начальный множитель из таблицы (используем количество для выплат)
      const initialMultiplier = payoutTables[payoutMinesCount][1] || 0.95;
      
      if (!payoutTables[payoutMinesCount]) {
        console.error(`ОШИБКА: Нет таблицы выплат для ${payoutMinesCount} мин. Доступные: ${Object.keys(payoutTables).join(', ')}`);
        throw new Error(`Неподдерживаемое количество мин для выплат: ${payoutMinesCount}`);
      }
      
      // Создаем запись об игре
      const game = new Game({
        user: user._id,
        gameType: 'mines',
        bet: betAmount,
        multiplier: initialMultiplier, // Используем значение из таблицы
        result: {
          grid,
          minesCount: actualMinesOnField, // Реальное количество мин на поле
          payoutMinesCount: payoutMinesCount, // Количество для расчета выплат
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
          minesCount: actualMinesOnField, // Реальное количество мин на поле
          payoutMinesCount: payoutMinesCount, // Количество для расчета выплат
          requestedMinesCount: minesCount, // Сохраняем запрошенное количество для отладки
          safeTotal: 25 - payoutMinesCount // Для расчета выплат используем payoutMinesCount
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
      const actualMinesOnField = game.result.minesCount; // Реальное количество мин на поле
      const payoutMinesCount = game.result.payoutMinesCount || game.gameData?.requestedMinesCount || actualMinesOnField; // Для расчета выплат
      const safeTotal = 25 - payoutMinesCount;
      
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
        const multiplier = payoutTables[payoutMinesCount][revealedCount];
        
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
        
        // ИСПРАВЛЕНИЕ: Создаем фейковую сетку для cashout (показываем мины при завершении)
        const requestedMinesCount = game.gameData.requestedMinesCount || payoutMinesCount;
        const displayGrid = this.generateDisplayGrid(game.result.grid, actualMinesOnField, requestedMinesCount, clickedCells, true);
        
        // Возвращаем данные для клиента
        return {
          win: true,
          multiplier,
          profit,
          balanceAfter: user.balance,
          clickedCells,
          grid: displayGrid, // Используем фейковую сетку
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
          
          // ИСПРАВЛЕНИЕ: Создаем фейковую сетку с запрошенным количеством мин для проигрыша
          const requestedMinesCount = game.gameData.requestedMinesCount || payoutMinesCount;
          const displayGrid = this.generateDisplayGrid(grid, actualMinesOnField, requestedMinesCount, clickedCells, true);
          
          // Возвращаем данные для клиента с фейковой сеткой
          return {
            win: false,
            clickedCells,
            grid: displayGrid, // Используем модифицированную сетку
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
            const maxMultiplier = payoutTables[payoutMinesCount][safeTotal - 1];
            
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
            
            // ИСПРАВЛЕНИЕ: Создаем фейковую сетку для максимального выигрыша
            const requestedMinesCount = game.gameData.requestedMinesCount || payoutMinesCount;
            const displayGrid = this.generateDisplayGrid(game.result.grid, actualMinesOnField, requestedMinesCount, clickedCells, true);
            
            // Возвращаем данные для клиента
            return {
              win: true,
              multiplier: maxMultiplier,
              profit,
              balanceAfter: user.balance,
              clickedCells,
              grid: displayGrid, // Используем фейковую сетку
              maxWin: true,
              serverSeedHashed: game.serverSeedHashed,
              clientSeed: game.clientSeed,
              nonce: game.nonce
            };
          } else {
            // Игра продолжается
            
            // Получаем множитель из таблицы для текущего количества открытых ячеек
            const multiplier = payoutTables[payoutMinesCount][revealedCount];
            
            if (!multiplier) {
              throw new Error('Ошибка расчета множителя');
            }
            
            console.log(`ОТЛАДКА МНОЖИТЕЛЯ: payoutMinesCount=${payoutMinesCount}, revealedCount=${revealedCount}, multiplier=${multiplier}`);
            
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
    
    // Если запрашивается конкретный тип игры и это не дуэли
    if (gameType && gameType !== 'duel') {
      const query = { user: user._id, gameType };
      
      const games = await Game.find(query)
        .sort(sort)
        .skip(Number(skip))
        .limit(Number(limit));
      
      const total = await Game.countDocuments(query);
      
      return {
        games,
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };
    }
    
    // Если запрашиваются только дуэли
    if (gameType === 'duel') {
      const { Duel } = require('../models');
      
      const duelQuery = {
        $or: [
          { challengerId: user.telegramId.toString() },
          { opponentId: user.telegramId.toString() }
        ],
        status: 'completed'
      };
      
      const duels = await Duel.find(duelQuery)
        .sort(sort)
        .skip(Number(skip))
        .limit(Number(limit));
      
      const total = await Duel.countDocuments(duelQuery);
      
      // Преобразуем дуэли в формат игр
      const duelGames = duels.map(duel => this.transformDuelToGame(duel, user.telegramId.toString()));
      
      return {
        games: duelGames,
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };
    }
    
    // Получаем все игры (обычные + дуэли)
    const { Duel } = require('../models');
    
    // Получаем обычные игры
    const gamesQuery = { user: user._id };
    const games = await Game.find(gamesQuery);
    
    // Получаем дуэли
    const duelQuery = {
      $or: [
        { challengerId: user.telegramId.toString() },
        { opponentId: user.telegramId.toString() }
      ],
      status: 'completed'
    };
    const duels = await Duel.find(duelQuery);
    
    // Преобразуем дуэли в формат игр
    const duelGames = duels.map(duel => this.transformDuelToGame(duel, user.telegramId.toString()));
    
    // Объединяем и сортируем
    const allGames = [...games, ...duelGames];
    allGames.sort((a, b) => {
      if (sort === '-createdAt') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    
    // Применяем пагинацию
    const paginatedGames = allGames.slice(Number(skip), Number(skip) + Number(limit));
    
    return {
      games: paginatedGames,
      total: allGames.length,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(allGames.length / limit)
    };
  }
  
  /**
   * Преобразование дуэли в формат игры для истории
   * @param {Object} duel - Объект дуэли
   * @param {string} userTelegramId - Telegram ID пользователя
   * @returns {Object} - Преобразованная игра
   */
  transformDuelToGame(duel, userTelegramId) {
    const isWinner = duel.winnerId === userTelegramId;
    const isChallenger = duel.challengerId === userTelegramId;
    const opponentUsername = isChallenger ? duel.opponentUsername : duel.challengerUsername;
    
    return {
      _id: duel._id,
      gameType: 'duel',
      bet: duel.amount,
      multiplier: isWinner ? (duel.winAmount / duel.amount) : 0,
      result: {
        duelType: duel.gameType,
        format: duel.format,
        opponent: opponentUsername,
        playerScore: isChallenger ? duel.challengerScore : duel.opponentScore,
        opponentScore: isChallenger ? duel.opponentScore : duel.challengerScore,
        sessionId: duel.sessionId
      },
      win: isWinner,
      profit: isWinner ? (duel.winAmount - duel.amount) : -duel.amount,
      balanceBefore: 0, // Не храним в дуэлях
      balanceAfter: 0,  // Не храним в дуэлях
      status: 'completed',
      createdAt: duel.createdAt,
      updatedAt: duel.updatedAt
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

  /**
   * Инициализация Crash игры
   */
  initializeCrash() {
    console.log('🚀 GAME SERVICE: Делегирование инициализации Crash сервису');
    // Ничего не делаем - crash.service.js инициализируется сам в init()
  }

  /**
   * Размещение ставки в Crash
   */
  async placeCrashBet(userData, gameData) {
    const crashService = require('./crash.service');
    return crashService.placeBet(userData.userId, gameData.betAmount, gameData.autoCashOut);
  }

  /**
   * Ручной вывод ставки
   */
  async cashOutCrash(userData) {
    const crashService = require('./crash.service');
    return crashService.manualCashOut(userData.userId);
  }

  /**
   * Получить текущее состояние игры
   */
  async getCurrentCrashState() {
    const crashService = require('./crash.service');
    return crashService.getCurrentGameStateAsync();
  }

  /**
   * Получить историю игр
   */
  async getCrashHistory(limit = 20) {
    const crashService = require('./crash.service');
    return crashService.getGameHistory(limit);
  }
}

module.exports = new GameService();
