// user.service.js
const { User, Transaction } = require('../models');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Сервис для управления пользователями
 */
class UserService {
  /**
   * Создать или обновить пользователя из данных Telegram
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} referralCode - Код реферала (опционально)
   * @returns {Object} - Созданный или обновленный пользователь
   */
  async createOrUpdateUser(telegramUser, referralCode = null) {
    const {
      id: telegramId,
      username,
      first_name: firstName,
      last_name: lastName = ''
    } = telegramUser;
    
    // Проверяем, существует ли уже пользователь
    let user = await User.findOne({ telegramId });
    
    if (user) {
      // Обновляем существующего пользователя
      user.username = username;
      user.firstName = firstName;
      user.lastName = lastName;
      user.lastActivity = new Date();
      await user.save();
      return user;
    }
    
    // Создаем реферальный код
    const generatedReferralCode = this.generateReferralCode();
    
    // Проверяем код реферала, если указан
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
    }
    
    // Создаем нового пользователя
    user = new User({
      telegramId,
      username,
      firstName,
      lastName,
      referralCode: generatedReferralCode,
      referrer: referrer ? referrer._id : null,
      balance: 0, // Начальный баланс
      lockedFunds: [], // Пустой массив заблокированных средств
      totalWagered: 0,
      totalWon: 0,
      totalGames: 0,
      freespins: {
        slots: 0,
        coin: 0,
        mines: 0
      },
      activeDepositBonuses: [],
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    await user.save();
    
    // Если был указан реферал, обновляем его счетчик
    if (referrer) {
      referrer.referralStats.totalReferrals += 1;
      await referrer.save();
    }
    
    return user;
  }
  
  /**
   * Генерирует уникальный реферальный код
   * @returns {string} - Реферальный код
   */
  generateReferralCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  
  /**
   * Получить баланс пользователя
   * @param {Object} userData - Данные пользователя
   * @returns {number} - Баланс пользователя
   */
  async getUserBalance(userData) {
    const { userId, telegramId } = userData;
    
    const user = await User.findOne(
      userId ? { _id: userId } : { telegramId }
    );
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    return user.balance;
  }
  
  /**
   * Изменить баланс пользователя
   * @param {Object} userData - Данные пользователя
   * @param {number} amount - Сумма изменения
   * @param {string} type - Тип транзакции
   * @param {string} description - Описание
   * @returns {Object} - Обновленный пользователь и созданная транзакция
   */
  async updateUserBalance(userData, amount, type, description) {
    const { userId, telegramId } = userData;
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // АТОМАРНОЕ обновление баланса с проверкой достаточности средств
        const user = await User.findOneAndUpdate(
          userId ? { _id: userId } : { telegramId },
          [
            {
              $set: {
                balanceBefore: '$balance', // Сохраняем старый баланс
                balance: {
                  $cond: {
                    if: { $gte: [{ $add: ['$balance', amount] }, 0] },
                    then: { $add: ['$balance', amount] },
                    else: { $error: { code: 'InsufficientFunds', msg: 'Недостаточно средств' } }
                  }
                },
                lastActivity: new Date()
              }
            }
          ],
          { 
            new: true,
            session,
            runValidators: true
          }
        );
        
        if (!user) {
          throw new Error('Пользователь не найден');
        }
        
        // Создаем транзакцию в той же сессии
        const transaction = new Transaction({
          user: user._id,
          type,
          amount,
          description,
          balanceBefore: user.balanceBefore,
          balanceAfter: user.balance
        });
        
        await transaction.save({ session });
        
        return { user, transaction };
      });
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Получить транзакции пользователя
   * @param {Object} userData - Данные пользователя
   * @param {Object} params - Параметры запроса
   * @returns {Array} - Транзакции пользователя
   */
  async getUserTransactions(userData, params = {}) {
    const { userId, telegramId } = userData;
    const { type, limit = 20, skip = 0, sort = '-createdAt' } = params;
    
    // Найдем пользователя
    const user = await User.findOne(
      userId ? { _id: userId } : { telegramId }
    );
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Строим условия поиска
    const query = { user: user._id };
    if (type) {
      query.type = type;
    }
    
    // Получаем транзакции
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip(Number(skip))
      .limit(Number(limit));
    
    // Получаем общее количество транзакций
    const total = await Transaction.countDocuments(query);
    
    return {
      transactions,
      total,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Найти пользователя по username
   * @param {string} username - Username пользователя
   * @returns {Object|null} - Найденный пользователь или null
   */
  async findUserByUsername(username) {
    return await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    }).select('telegramId username firstName lastName');
  }
}

module.exports = new UserService();