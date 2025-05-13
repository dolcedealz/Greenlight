// game.service.js
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
        }
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