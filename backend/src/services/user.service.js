// user.service.js
const { User, Transaction } = require('../models');
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
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    await user.save();
    
    // Если был указан реферал, обновляем его счетчик
    if (referrer) {
      referrer.referralCount += 1;
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
    
    const user = await User.findOne(
      userId ? { _id: userId } : { telegramId }
    );
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Проверяем, что баланс не станет отрицательным
    if (user.balance + amount < 0) {
      throw new Error('Недостаточно средств');
    }
    
    const balanceBefore = user.balance;
    user.balance += amount;
    user.lastActivity = new Date();
    
    await user.save();
    
    // Создаем транзакцию
    const transaction = new Transaction({
      user: user._id,
      type,
      amount,
      description,
      balanceBefore,
      balanceAfter: user.balance
    });
    
    await transaction.save();
    
    return { user, transaction };
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
}

module.exports = new UserService();