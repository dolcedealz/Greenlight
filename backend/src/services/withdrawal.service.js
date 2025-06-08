// backend/src/services/withdrawal.service.js - УЛУЧШЕННАЯ ВЕРСИЯ
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

    // Добавляем интерсептор для логирования запросов
    this.api.interceptors.request.use(request => {
      console.log('🚀 CryptoBot API Request:', {
        method: request.method.toUpperCase(),
        url: request.url,
        headers: { ...request.headers, 'Crypto-Pay-API-Token': '[HIDDEN]' },
        data: request.data
      });
      return request;
    });

    // Добавляем интерсептор для логирования ответов
    this.api.interceptors.response.use(
      response => {
        console.log('✅ CryptoBot API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      error => {
        console.error('❌ CryptoBot API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Проверяет баланс казино в CryptoBot
   */
  async checkCasinoBalance() {
    try {
      console.log('💰 Проверка баланса казино в CryptoBot...');
      const response = await this.api.get('/getBalance');
      
      if (response.data.ok) {
        const balances = response.data.result;
        console.log('💰 Балансы казино:', balances);
        
        // Находим баланс USDT
        const usdtBalance = balances.find(b => b.currency_code === 'USDT');
        if (usdtBalance) {
          console.log(`💰 Баланс USDT: ${usdtBalance.available} (доступно), ${usdtBalance.onhold} (заморожено)`);
          return parseFloat(usdtBalance.available);
        }
        
        console.warn('⚠️ Баланс USDT не найден');
        return 0;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Ошибка проверки баланса:', error);
      return 0;
    }
  }

  /**
   * Создает запрос на вывод средств с улучшенной обработкой
   */
  async createWithdrawal(userId, withdrawalData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`🔄 WITHDRAWAL: Создание запроса на вывод для пользователя ${userId}`);
      
      const { amount, recipient, recipientType, comment, metadata } = withdrawalData;
      
      // Проверяем пользователя
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (user.isBlocked) {
        throw new Error('Ваш аккаунт заблокирован');
      }
      
      console.log(`👤 WITHDRAWAL: Пользователь: ${user.firstName} ${user.lastName}, баланс: ${user.balance}`);
      
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
        console.warn(`⚠️ WITHDRAWAL: У пользователя есть ${activeWithdrawals.length} активных выводов`);
        throw new Error('У вас уже есть активный запрос на вывод. Дождитесь его обработки.');
      }
      
      // НОВОЕ: Проверяем баланс казино перед созданием вывода
      const casinoBalance = await this.checkCasinoBalance();
      if (casinoBalance < amount * 1.1) { // Проверяем с запасом 10%
        console.error(`❌ WITHDRAWAL: Недостаточно средств казино. Требуется: ${amount}, доступно: ${casinoBalance}`);
        throw new Error('Временно недоступно. Попробуйте позже или уменьшите сумму.');
      }
      
      // Валидация получателя
      if (recipientType === 'username') {
        if (!recipient.match(/^@?[a-zA-Z0-9_]{5,32}$/)) {
          throw new Error('Некорректный Telegram username');
        }
      } else if (recipientType === 'wallet') {
        if (!recipient || recipient.length < 10) {
          throw new Error('Некорректный адрес кошелька');
        }
      }
      
      // Определяем, требует ли одобрения
      const requiresApproval = amount > 300;
      
      // АТОМАРНОЕ обновление баланса и создание записи о выводе
      const updatedUser = await User.findOneAndUpdate(
        { 
          _id: userId,
          balance: { $gte: amount } // Дополнительная проверка достаточности средств
        },
        [
          {
            $set: {
              balanceBefore: '$balance',
              balance: { $subtract: ['$balance', amount] },
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
      
      if (!updatedUser) {
        throw new Error('Недостаточно средств или пользователь не найден');
      }
      
      // Создаем запись о выводе
      const withdrawal = new Withdrawal({
        user: userId,
        amount,
        recipient: recipient.replace('@', ''),
        recipientType,
        status: requiresApproval ? 'pending' : 'approved',
        requiresApproval,
        balanceBefore: updatedUser.balanceBefore,
        balanceAfter: updatedUser.balance,
        platformFee: 0,
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
      
      // Создаем транзакцию для учета
      const transaction = new Transaction({
        user: userId,
        type: 'withdrawal',
        amount: -amount,
        status: 'pending',
        description: `Запрос на вывод ${amount} USDT`,
        balanceBefore: updatedUser.balanceBefore,
        balanceAfter: updatedUser.balance,
        payment: {
          invoiceId: withdrawal._id.toString(),
          paymentMethod: 'cryptobot',
          externalReference: null
        }
      });
      
      await transaction.save({ session });
      
      await session.commitTransaction();
      
      console.log(`✅ WITHDRAWAL: Запрос на вывод создан: ${withdrawal._id}, требует одобрения: ${requiresApproval}`);
      
      // Если не требует одобрения, сразу обрабатываем
      if (!requiresApproval) {
        console.log(`⚡ WITHDRAWAL: Автоматическая обработка вывода ${withdrawal._id}`);
        
        // Запускаем обработку в фоне с задержкой
        setTimeout(() => {
          this.processWithdrawal(withdrawal._id).catch(error => {
            console.error(`❌ WITHDRAWAL: Ошибка автоматической обработки: ${error.message}`);
          });
        }, 3000); // Задержка 3 секунды
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
      console.error('❌ WITHDRAWAL: Ошибка создания запроса на вывод:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Обрабатывает вывод через CryptoBot с улучшенной обработкой ошибок
   */
  async processWithdrawal(withdrawalId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`🔄 WITHDRAWAL: Начало обработки вывода ${withdrawalId}`);
      
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
      
      console.log(`📤 WITHDRAWAL: Отправка перевода через CryptoBot`);
      console.log(`- Получатель: ${withdrawal.recipient}`);
      console.log(`- Сумма: ${withdrawal.amount} USDT`);
      console.log(`- Тип: ${withdrawal.recipientType}`);
      
      // НОВОЕ: Повторная проверка баланса перед отправкой
      const casinoBalance = await this.checkCasinoBalance();
      if (casinoBalance < withdrawal.amount) {
        throw new Error(`Недостаточно средств казино для вывода. Доступно: ${casinoBalance} USDT`);
      }
      
      // Отправляем запрос в CryptoBot для создания перевода
      const transferData = await this.createCryptoBotTransfer(withdrawal);
      
      console.log(`✅ WITHDRAWAL: Перевод создан в CryptoBot:`, transferData);
      
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
      
      // Обновляем финансовую статистику
      const financeService = require('./casino-finance.service');
      await financeService.updateAfterUserWithdrawal({
        amount: withdrawal.amount,
        user: withdrawal.user._id
      });
      
      console.log(`✅ WITHDRAWAL: Вывод ${withdrawalId} успешно обработан`);
      
      // Отправляем уведомление об успешном выводе
      try {
        const notificationService = require('../../../bot/src/services/notification.service');
        await notificationService.notifyWithdrawalCompleted(withdrawal.user.telegramId, withdrawal);
      } catch (notifyError) {
        console.error('⚠️ WITHDRAWAL: Ошибка отправки уведомления:', notifyError);
      }
      
      return withdrawal;
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`❌ WITHDRAWAL: Ошибка обработки вывода ${withdrawalId}:`, error);
      console.error('📋 WITHDRAWAL: Детали ошибки:', {
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
        console.error('❌ WITHDRAWAL: Ошибка обновления статуса:', updateError);
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Создает перевод через CryptoBot API с улучшенной обработкой
   */
  async createCryptoBotTransfer(withdrawal) {
    try {
      // Получаем полную информацию о withdrawal с пользователем
      const fullWithdrawal = await Withdrawal.findById(withdrawal._id)
        .populate('user', 'telegramId username');
      
      if (!fullWithdrawal || !fullWithdrawal.user) {
        throw new Error('Не удалось получить данные пользователя для вывода');
      }
      
      let recipientTelegramId;
      
      if (withdrawal.recipientType === 'username') {
        // Если получатель - это тот же пользователь (вывод самому себе)
        if (withdrawal.recipient.toLowerCase() === fullWithdrawal.user.username?.toLowerCase()) {
          recipientTelegramId = fullWithdrawal.user.telegramId;
        } else {
          // Для вывода другому пользователю нужно найти его в БД
          const recipientUser = await User.findOne({ 
            username: new RegExp(`^${withdrawal.recipient}$`, 'i') 
          });
          
          if (!recipientUser) {
            throw new Error(`Пользователь @${withdrawal.recipient} не найден в системе. Получатель должен быть зарегистрирован в казино.`);
          }
          
          recipientTelegramId = recipientUser.telegramId;
        }
      } else {
        throw new Error('Вывод на кошелек временно недоступен');
      }
      
      // ВАЖНО: Используем уникальный spend_id с timestamp для избежания конфликтов
      const spendId = `${withdrawal._id}_${Date.now()}`;
      
      const payload = {
        user_id: recipientTelegramId,
        asset: 'USDT',
        amount: withdrawal.amount.toString(),
        spend_id: spendId, // Уникальный ID с timestamp
        disable_send_notification: false
      };
      
      console.log('📤 WITHDRAWAL: Отправка запроса transfer в CryptoBot:');
      console.log(`- Получатель: @${withdrawal.recipient} (Telegram ID: ${recipientTelegramId})`);
      console.log(`- Сумма: ${payload.amount} ${payload.asset}`);
      console.log(`- Spend ID: ${payload.spend_id}`);
      
      const response = await this.api.post('/transfer', payload);
      
      if (!response.data.ok) {
        const error = response.data.error || {};
        console.error('❌ CryptoBot API отклонил запрос:', error);
        throw new Error(`CryptoBot API Error: ${error.name || 'Unknown error'}`);
      }
      
      console.log('✅ WITHDRAWAL: Transfer успешно создан:', response.data.result);
      
      return response.data.result;
      
    } catch (error) {
      if (error.response) {
        console.error('❌ WITHDRAWAL: CryptoBot API Error Response:', error.response.data);
        
        const errorCode = error.response.data.error?.code;
        const errorName = error.response.data.error?.name;
        
        // Детальная обработка ошибок
        if (errorCode === 'USER_NOT_FOUND' || errorName === 'USER_NOT_FOUND') {
          throw new Error('Получатель не найден в CryptoBot. Убедитесь, что получатель использовал @CryptoBot.');
        } else if (errorName === 'INSUFFICIENT_FUNDS') {
          throw new Error('Недостаточно средств на счете казино для выполнения вывода');
        } else if (errorName === 'TRANSFER_LIMIT_EXCEEDED') {
          throw new Error('Превышен лимит переводов. Попробуйте позже.');
        } else if (errorName === 'USER_ID_INVALID') {
          throw new Error('Некорректный ID получателя. Обратитесь в поддержку.');
        } else if (errorName === 'SPEND_ID_DUPLICATE') {
          throw new Error('Дублирование запроса. Попробуйте через несколько секунд.');
        } else if (errorName === 'CANNOT_ATTACH_COMMENT') {
          // Игнорируем эту ошибку, так как comment не критичен
          console.warn('⚠️ WITHDRAWAL: Комментарий не поддерживается');
        }
        
        throw new Error(`CryptoBot API: ${errorName || errorCode || 'Неизвестная ошибка'}`);
      }
      throw error;
    }
  }

  /**
   * Возвращает средства пользователю при неудачном выводе
   */
  async refundFailedWithdrawal(withdrawal) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`💸 WITHDRAWAL: Возврат средств для неудачного вывода ${withdrawal._id}`);
      
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
      
      console.log(`✅ WITHDRAWAL: Средства (${withdrawal.amount} USDT) возвращены пользователю ${user._id}`);
      
      // Отправляем уведомление пользователю
      try {
        const notificationService = require('../../../bot/src/services/notification.service');
        await notificationService.notifyWithdrawalRejected(user.telegramId, {
          ...withdrawal.toObject(),
          rejectionReason: 'Технические проблемы. Средства возвращены на баланс.'
        });
      } catch (notifyError) {
        console.error('⚠️ WITHDRAWAL: Ошибка отправки уведомления о возврате:', notifyError);
      }
      
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ WITHDRAWAL: Ошибка возврата средств:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Получает информацию о выводе
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
    
    // Запускаем обработку с задержкой
    setTimeout(() => {
      this.processWithdrawal(withdrawalId).catch(error => {
        console.error(`❌ WITHDRAWAL: Ошибка обработки после одобрения: ${error.message}`);
      });
    }, 3000);
    
    // Отправляем уведомление пользователю
    try {
      const notificationService = require('../../../bot/src/services/notification.service');
      await notificationService.notifyWithdrawalApproved(withdrawal.user.telegramId, withdrawal);
    } catch (notifyError) {
      console.error('⚠️ WITHDRAWAL: Ошибка отправки уведомления об одобрении:', notifyError);
    }
    
    return withdrawal;
  }

  /**
   * Отклоняет запрос на вывод (для администратора)
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
    
    return withdrawal;
  }

  /**
   * Получает выводы, требующие одобрения
   */
  async getPendingApprovals() {
    return await Withdrawal.getPendingApprovals();
  }

  /**
   * Получает статистику по выводам
   */
  async getWithdrawalStats(userId = null) {
    return await Withdrawal.getWithdrawalStats(userId);
  }
}

module.exports = new WithdrawalService();