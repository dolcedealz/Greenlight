// backend/src/services/withdrawal.service.js
const axios = require('axios');
const { Withdrawal, User, Transaction } = require('../models');
const mongoose = require('mongoose');

class WithdrawalService {
  constructor() {
    this.cryptoBotApiUrl = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    
    if (!this.cryptoBotToken) {
      throw new Error('CRYPTO_PAY_API_TOKEN не указан в переменных окружения');
    }
    
    // Создаем axios instance для работы с CryptoBot API
    this.api = axios.create({
      baseURL: this.cryptoBotApiUrl,
      headers: {
        'Crypto-Pay-API-Token': this.cryptoBotToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Создает запрос на вывод средств
   * @param {string} userId - ID пользователя
   * @param {Object} withdrawalData - Данные для вывода
   * @returns {Object} - Созданный запрос на вывод
   */
  async createWithdrawal(userId, withdrawalData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`WITHDRAWAL: Создание запроса на вывод для пользователя ${userId}`);
      
      const { amount, recipient, recipientType, comment, metadata } = withdrawalData;
      
      // Проверяем пользователя
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (user.isBlocked) {
        throw new Error('Ваш аккаунт заблокирован');
      }
      
      console.log(`WITHDRAWAL: Пользователь: ${user.firstName} ${user.lastName}, баланс: ${user.balance}`);
      
      // Валидация суммы
      if (amount < 1) {
        throw new Error('Минимальная сумма вывода: 1 USDT');
      }
      
      if (amount > 10000) {
        throw new Error('Максимальная сумма вывода: 10000 USDT');
      }
      
      // Проверяем достаточность баланса
      if (user.balance < amount) {
        throw new Error('Недостаточно средств на балансе');
      }
      
      // Проверяем наличие других активных выводов
      const activeWithdrawals = await Withdrawal.find({
        user: userId,
        status: { $in: ['pending', 'approved', 'processing'] }
      }).session(session);
      
      if (activeWithdrawals.length > 0) {
        throw new Error('У вас уже есть активный запрос на вывод. Дождитесь его обработки.');
      }
      
      // Валидация получателя
      if (recipientType === 'username') {
        // Для username проверяем, что это корректный Telegram username
        if (!recipient.match(/^@?[a-zA-Z0-9_]{5,32}$/)) {
          throw new Error('Некорректный Telegram username');
        }
      } else if (recipientType === 'wallet') {
        // Для кошелька проверяем формат (можно добавить более строгую валидацию)
        if (!recipient || recipient.length < 10) {
          throw new Error('Некорректный адрес кошелька');
        }
      }
      
      // Определяем, требует ли одобрения
      const requiresApproval = amount > 300;
      
      // Баланс до и после
      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - amount;
      
      // Создаем запись о выводе
      const withdrawal = new Withdrawal({
        user: userId,
        amount,
        recipient: recipient.replace('@', ''), // Убираем @ если есть
        recipientType,
        status: requiresApproval ? 'pending' : 'approved', // Автоодобрение для малых сумм
        requiresApproval,
        balanceBefore,
        balanceAfter,
        platformFee: 0, // Можно добавить комиссию платформы
        netAmount: amount,
        comment,
        userIp: metadata?.userIp,
        metadata: {
          source: metadata?.source || 'web',
          sessionId: metadata?.sessionId,
          userAgent: metadata?.userAgent
        }
      });
      
      await withdrawal.save({ session });
      
      // Обновляем баланс пользователя (блокируем средства)
      user.balance = balanceAfter;
      user.lastActivity = new Date();
      await user.save({ session });
      
      // Создаем транзакцию для учета
      const transaction = new Transaction({
        user: userId,
        type: 'withdrawal',
        amount: -amount,
        status: 'pending',
        description: `Запрос на вывод ${amount} USDT`,
        balanceBefore,
        balanceAfter,
        payment: {
          invoiceId: withdrawal._id.toString(),
          paymentMethod: 'cryptobot',
          externalReference: null // Будет обновлено после обработки
        }
      });
      
      await transaction.save({ session });
      
      await session.commitTransaction();
      
      console.log(`WITHDRAWAL: Запрос на вывод создан: ${withdrawal._id}, требует одобрения: ${requiresApproval}`);
      
      // Если не требует одобрения, сразу обрабатываем
      if (!requiresApproval) {
        console.log(`WITHDRAWAL: Автоматическая обработка вывода ${withdrawal._id}`);
        
        // Запускаем обработку в фоне, чтобы не задерживать ответ
        this.processWithdrawal(withdrawal._id).catch(error => {
          console.error(`WITHDRAWAL: Ошибка автоматической обработки: ${error.message}`);
        });
      }
      
      return {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        recipient: withdrawal.recipient,
        recipientType: withdrawal.recipientType,
        status: withdrawal.status,
        requiresApproval: withdrawal.requiresApproval,
        estimatedTime: requiresApproval ? '24-48 часов' : '5-15 минут'
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('WITHDRAWAL: Ошибка создания запроса на вывод:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Обрабатывает вывод через CryptoBot
   * @param {string} withdrawalId - ID запроса на вывод
   */
  async processWithdrawal(withdrawalId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`WITHDRAWAL: Начало обработки вывода ${withdrawalId}`);
      
      // Получаем запрос на вывод
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate('user')
        .session(session);
      
      if (!withdrawal) {
        throw new Error('Запрос на вывод не найден');
      }
      
      // Проверяем, можно ли обработать
      if (!withdrawal.canProcess()) {
        throw new Error('Запрос на вывод не может быть обработан в текущем статусе');
      }
      
      // Помечаем как обрабатываемый
      await withdrawal.markAsProcessing();
      
      console.log(`WITHDRAWAL: Отправка перевода через CryptoBot`);
      console.log(`- Получатель: ${withdrawal.recipient}`);
      console.log(`- Сумма: ${withdrawal.amount} USDT`);
      console.log(`- Тип: ${withdrawal.recipientType}`);
      
      // Отправляем запрос в CryptoBot для создания перевода
      const transferData = await this.createCryptoBotTransfer(withdrawal);
      
      console.log(`WITHDRAWAL: Перевод создан в CryptoBot:`, transferData);
      
      // Обновляем запись с данными от CryptoBot
      withdrawal.cryptoBotData = {
        transferId: transferData.transfer_id,
        fee: transferData.fee || 0,
        totalAmount: transferData.amount,
        createdAt: new Date(),
        responseData: transferData
      };
      
      // Помечаем как завершенный
      await withdrawal.complete({
        transferId: transferData.transfer_id,
        hash: transferData.hash,
        completedAt: new Date()
      });
      
      // Обновляем транзакцию
      await Transaction.updateOne(
        { 
          user: withdrawal.user._id,
          'payment.invoiceId': withdrawalId.toString()
        },
        {
          $set: {
            status: 'completed',
            'payment.externalReference': transferData.transfer_id
          }
        }
      ).session(session);
      
      await session.commitTransaction();
      
      console.log(`WITHDRAWAL: Вывод ${withdrawalId} успешно обработан`);
      
      // Отправляем уведомление об успешном выводе
      const notificationService = require('../../../bot/src/services/notification.service');
      await notificationService.notifyWithdrawalCompleted(withdrawal.user.telegramId, withdrawal);
      
      return withdrawal;
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`WITHDRAWAL: Ошибка обработки вывода ${withdrawalId}:`, error);
      console.error('WITHDRAWAL: Полная информация об ошибке:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      
      // Сохраняем детали ошибки в withdrawal
      try {
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (withdrawal) {
          withdrawal.lastError = {
            message: error.message || 'Unknown error',
            details: error.response?.data || {},
            timestamp: new Date()
          };
          await withdrawal.markAsFailed(error);
          
          // Возвращаем средства пользователю
          await this.refundFailedWithdrawal(withdrawal);
        }
      } catch (updateError) {
        console.error('WITHDRAWAL: Ошибка обновления статуса:', updateError);
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Создает перевод через CryptoBot API
   * @param {Object} withdrawal - Объект вывода
   * @returns {Object} - Данные перевода от CryptoBot
   */
  async createCryptoBotTransfer(withdrawal) {
    try {
      const payload = {
        user_id: withdrawal.recipient, // Для username
        asset: 'USDT',
        amount: withdrawal.amount.toString(),
        spend_id: withdrawal._id.toString(), // Уникальный ID для идемпотентности
        comment: withdrawal.comment || `Вывод средств из Greenlight Casino`,
        disable_send_notification: false
      };
      
      // Если это адрес кошелька, используем другой метод
      if (withdrawal.recipientType === 'wallet') {
        // CryptoBot пока не поддерживает прямые переводы на кошельки
        // Это заглушка для будущей реализации
        throw new Error('Вывод на кошелек временно недоступен');
      }
      
      console.log('WITHDRAWAL: Отправка запроса transfer в CryptoBot:', payload);
      
      const response = await this.api.post('/transfer', payload);
      
      if (!response.data.ok) {
        throw new Error(`CryptoBot API Error: ${response.data.error?.name || 'Unknown error'}`);
      }
      
      return response.data.result;
      
    } catch (error) {
      if (error.response) {
        console.error('WITHDRAWAL: CryptoBot API Error:', error.response.data);
        
        // Обработка специфичных ошибок CryptoBot
        const errorCode = error.response.data.error?.code;
        
        if (errorCode === 'USER_NOT_FOUND') {
          throw new Error('Получатель не найден. Проверьте правильность username.');
        } else if (errorCode === 'INSUFFICIENT_FUNDS') {
          throw new Error('Недостаточно средств на счете казино');
        } else if (errorCode === 'TRANSFER_LIMIT_EXCEEDED') {
          throw new Error('Превышен лимит переводов');
        }
        
        throw new Error(`CryptoBot API Error: ${error.response.data.error?.name || error.response.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Возвращает средства пользователю при неудачном выводе
   * @param {Object} withdrawal - Объект вывода
   */
  async refundFailedWithdrawal(withdrawal) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`WITHDRAWAL: Возврат средств для неудачного вывода ${withdrawal._id}`);
      
      const user = await User.findById(withdrawal.user).session(session);
      if (!user) {
        throw new Error('Пользователь не найден для возврата средств');
      }
      
      // Возвращаем средства
      const oldBalance = user.balance;
      const newBalance = oldBalance + withdrawal.amount;
      
      user.balance = newBalance;
      await user.save({ session });
      
      // Создаем транзакцию возврата
      const refundTransaction = new Transaction({
        user: user._id,
        type: 'deposit',
        amount: withdrawal.amount,
        status: 'completed',
        description: `Возврат средств за неудачный вывод #${withdrawal._id}`,
        balanceBefore: oldBalance,
        balanceAfter: newBalance
      });
      
      await refundTransaction.save({ session });
      
      await session.commitTransaction();
      
      console.log(`WITHDRAWAL: Средства возвращены пользователю ${user._id}`);
      
    } catch (error) {
      await session.abortTransaction();
      console.error('WITHDRAWAL: Ошибка возврата средств:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Получает информацию о выводе
   * @param {string} withdrawalId - ID вывода
   * @returns {Object} - Информация о выводе
   */
  async getWithdrawalInfo(withdrawalId) {
    const withdrawal = await Withdrawal.findById(withdrawalId)
      .populate('user', 'telegramId username firstName lastName')
      .populate('approvedBy', 'username firstName lastName');
    
    if (!withdrawal) {
      throw new Error('Запрос на вывод не найден');
    }
    
    return withdrawal;
  }

  /**
   * Получает историю выводов пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} params - Параметры фильтрации
   * @returns {Object} - История выводов
   */
  async getUserWithdrawals(userId, params = {}) {
    const { limit = 20, skip = 0, status } = params;
    
    const query = { user: userId };
    if (status) {
      query.status = status;
    }
    
    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    
    const total = await Withdrawal.countDocuments(query);
    
    return {
      withdrawals,
      total,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Одобряет запрос на вывод (для администратора)
   * @param {string} withdrawalId - ID вывода
   * @param {string} adminId - ID администратора
   */
  async approveWithdrawal(withdrawalId, adminId) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    
    if (!withdrawal) {
      throw new Error('Запрос на вывод не найден');
    }
    
    if (withdrawal.status !== 'pending') {
      throw new Error('Можно одобрить только запросы в статусе "pending"');
    }
    
    await withdrawal.approve(adminId);
    
    // Запускаем обработку
    this.processWithdrawal(withdrawalId).catch(error => {
      console.error(`WITHDRAWAL: Ошибка обработки после одобрения: ${error.message}`);
    });
    
    // Отправляем уведомление пользователю
    const notificationService = require('../../../bot/src/services/notification.service');
    await notificationService.notifyWithdrawalApproved(withdrawal.user.telegramId, withdrawal);
    
    return withdrawal;
  }

  /**
   * Отклоняет запрос на вывод (для администратора)
   * @param {string} withdrawalId - ID вывода
   * @param {string} adminId - ID администратора
   * @param {string} reason - Причина отклонения
   */
  async rejectWithdrawal(withdrawalId, adminId, reason) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    
    if (!withdrawal) {
      throw new Error('Запрос на вывод не найден');
    }
    
    if (withdrawal.status !== 'pending') {
      throw new Error('Можно отклонить только запросы в статусе "pending"');
    }
    
    await withdrawal.reject(adminId, reason);
    
    // Возвращаем средства пользователю
    await this.refundFailedWithdrawal(withdrawal);
    
    // Отправляем уведомление пользователю
    const notificationService = require('../../../bot/src/services/notification.service');
    await notificationService.notifyWithdrawalRejected(withdrawal.user.telegramId, withdrawal);
    
    return withdrawal;
  }

  /**
   * Получает выводы, требующие одобрения
   * @returns {Array} - Список выводов
   */
  async getPendingApprovals() {
    return await Withdrawal.getPendingApprovals();
  }

  /**
   * Получает статистику по выводам
   * @param {string} userId - ID пользователя (опционально)
   * @returns {Object} - Статистика
   */
  async getWithdrawalStats(userId = null) {
    return await Withdrawal.getWithdrawalStats(userId);
  }
}

module.exports = new WithdrawalService();