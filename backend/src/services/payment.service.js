// backend/src/services/payment.service.js
const axios = require('axios');
const crypto = require('crypto');
const { Deposit, User } = require('../models');

class PaymentService {
  constructor() {
    this.cryptoBotApiUrl = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    this.webhookSecret = process.env.CRYPTO_PAY_WEBHOOK_SECRET; // Для верификации webhook'ов
    
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
   * Создает депозит для пользователя
   * @param {string} userId - ID пользователя в нашей системе
   * @param {number} amount - Сумма в USDT
   * @param {Object} metadata - Дополнительные данные
   * @returns {Object} - Данные созданного депозита
   */
  async createDeposit(userId, amount, metadata = {}) {
    try {
      console.log(`Создаем депозит для пользователя ${userId} на сумму ${amount} USDT`);
      
      // Проверяем пользователя
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Валидация суммы
      if (amount < 0.01 || amount > 10000) {
        throw new Error('Сумма должна быть от 0.01 до 10000 USDT');
      }
      
      // Создаем инвойс в CryptoBot
      const invoiceData = await this.createCryptoBotInvoice(amount, userId, metadata);
      
      // Создаем запись депозита в нашей БД
      const deposit = new Deposit({
        user: userId,
        invoiceId: invoiceData.invoice_id.toString(), // Приводим к строке для консистентности
        amount: amount,
        status: 'pending',
        balanceBefore: user.balance,
        balanceAfter: user.balance, // Пока не изменяем
        description: metadata.description || `Пополнение баланса на ${amount} USDT`,
        userIp: metadata.userIp,
        metadata: {
          source: metadata.source || 'web',
          sessionId: metadata.sessionId,
          referralCode: metadata.referralCode
        },
        cryptoBotData: {
          invoiceId: invoiceData.invoice_id.toString(),
          asset: invoiceData.asset,
          payAmount: invoiceData.amount,
          payUrl: invoiceData.pay_url,
          createdAt: new Date(invoiceData.created_at),
          hash: null,
          paidAt: null,
          webhookData: null
        }
      });
      
      await deposit.save();
      
      console.log(`Депозит создан: ID=${deposit._id}, InvoiceId=${invoiceData.invoice_id}`);
      
      return {
        depositId: deposit._id,
        invoiceId: invoiceData.invoice_id,
        amount: amount,
        payUrl: invoiceData.pay_url,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(invoiceData.pay_url)}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 час
        status: 'pending'
      };
      
    } catch (error) {
      console.error('Ошибка создания депозита:', error);
      throw error;
    }
  }

  /**
   * Создает инвойс в CryptoBot
   * @param {number} amount - Сумма в USDT
   * @param {string} userId - ID пользователя
   * @param {Object} metadata - Метаданные
   * @returns {Object} - Данные инвойса от CryptoBot
   */
  async createCryptoBotInvoice(amount, userId, metadata = {}) {
    try {
      const payload = {
        asset: 'USDT',
        amount: amount.toString(),
        description: `Пополнение баланса Greenlight Casino`,
        hidden_message: `Депозит для пользователя ${userId}`,
        paid_btn_name: 'callback', // После оплаты вернется в приложение
        paid_btn_url: process.env.WEBAPP_URL || 'https://t.me/greenlight_casino_bot',
        allow_comments: false,
        allow_anonymous: true,
        expires_in: 3600 // 1 час на оплату
      };
      
      console.log('Отправляем запрос в CryptoBot:', payload);
      
      const response = await this.api.post('/createInvoice', payload);
      
      if (!response.data.ok) {
        throw new Error(`CryptoBot API Error: ${response.data.error?.name || 'Unknown error'}`);
      }
      
      console.log('Ответ от CryptoBot:', response.data.result);
      
      return response.data.result;
      
    } catch (error) {
      if (error.response) {
        console.error('CryptoBot API Error:', error.response.data);
        throw new Error(`CryptoBot API Error: ${error.response.data.error?.name || error.response.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Извлекает Telegram ID из hidden_message
   * @param {string} hiddenMessage - Скрытое сообщение от CryptoBot
   * @returns {number|null} - Telegram ID или null
   */
  extractTelegramIdFromHiddenMessage(hiddenMessage) {
    if (!hiddenMessage) return null;
    
    // Пытаемся извлечь ID из формата "Пополнение для пользователя #123456"
    const match = hiddenMessage.match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Создает депозит "на лету" для потерянных платежей
   * @param {Object} webhookPayload - Данные из webhook
   * @returns {Object} - Созданный депозит или null
   */
  async createFallbackDeposit(webhookPayload) {
    try {
      console.log('Создаем fallback депозит для потерянного платежа');
      
      // Извлекаем Telegram ID из hidden_message
      const telegramId = this.extractTelegramIdFromHiddenMessage(webhookPayload.hidden_message);
      
      if (!telegramId) {
        console.warn('Не удалось извлечь Telegram ID из hidden_message:', webhookPayload.hidden_message);
        return null;
      }
      
      console.log(`Найден Telegram ID в hidden_message: ${telegramId}`);
      
      // Ищем пользователя по Telegram ID
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        console.warn(`Пользователь с Telegram ID ${telegramId} не найден`);
        return null;
      }
      
      console.log(`Найден пользователь: ${user._id} (${user.firstName} ${user.lastName})`);
      
      // Создаем fallback депозит
      const deposit = new Deposit({
        user: user._id,
        invoiceId: webhookPayload.invoice_id.toString(),
        amount: parseFloat(webhookPayload.amount),
        status: 'pending', // Начальный статус, будет обновлен далее
        balanceBefore: user.balance,
        balanceAfter: user.balance,
        description: `Fallback депозит для инвойса ${webhookPayload.invoice_id}`,
        metadata: {
          source: 'fallback',
          sessionId: null,
          referralCode: null
        },
        cryptoBotData: {
          invoiceId: webhookPayload.invoice_id.toString(),
          asset: webhookPayload.asset,
          payAmount: parseFloat(webhookPayload.amount),
          payUrl: webhookPayload.pay_url,
          createdAt: new Date(webhookPayload.created_at),
          hash: webhookPayload.hash,
          paidAt: webhookPayload.paid_at ? new Date(webhookPayload.paid_at) : null,
          webhookData: webhookPayload
        }
      });
      
      await deposit.save();
      
      console.log(`Fallback депозит создан: ${deposit._id}`);
      return deposit;
      
    } catch (error) {
      console.error('Ошибка создания fallback депозита:', error);
      return null;
    }
  }

  /**
   * Обрабатывает webhook от CryptoBot - УЛУЧШЕНО с fallback механизмом
   * @param {Object} webhookPayload - Данные от webhook (payload из CryptoBot)
   * @param {string} signature - Подпись для верификации
   * @returns {Object} - Результат обработки
   */
  async processWebhook(webhookPayload, signature = null) {
    try {
      console.log('Обрабатываем payload webhook от CryptoBot:', webhookPayload);
      
      // Извлекаем данные из payload
      const { 
        invoice_id, 
        status, 
        amount, 
        asset, 
        paid_at, 
        hash,
        paid_amount,
        fee_amount 
      } = webhookPayload;
      
      console.log(`Ищем депозит с invoice_id: ${invoice_id}`);
      
      // Находим депозит по invoice_id - приводим к строке для поиска
      let deposit = await Deposit.findOne({ 
        invoiceId: invoice_id.toString() 
      });
      
      // НОВЫЙ FALLBACK МЕХАНИЗМ
      if (!deposit) {
        console.warn(`Депозит не найден для invoice_id: ${invoice_id}`);
        console.log('Пытаемся создать fallback депозит...');
        
        deposit = await this.createFallbackDeposit(webhookPayload);
        
        if (!deposit) {
          console.error('Не удалось создать fallback депозит');
          return { success: false, message: 'Депозит не найден и не удалось создать fallback' };
        }
        
        console.log(`Fallback депозит создан успешно: ${deposit._id}`);
      } else {
        console.log(`Найден депозит: ${deposit._id}, текущий статус: ${deposit.status}`);
      }
      
      // Если депозит уже обработан, не обрабатываем повторно
      if (deposit.status === 'paid') {
        console.log(`Депозит ${deposit._id} уже обработан`);
        return { success: true, message: 'Депозит уже обработан' };
      }
      
      // Обновляем депозит данными из webhook
      await this.updateDepositFromWebhook(deposit, webhookPayload);
      
      // Если статус "paid" - зачисляем средства пользователю
      if (status === 'paid') {
        console.log(`Статус платежа 'paid', зачисляем средства пользователю`);
        await this.creditUserBalance(deposit);
        
        console.log(`Депозит ${deposit._id} успешно обработан, баланс пользователя обновлен`);
        
        return {
          success: true,
          message: 'Депозит успешно обработан',
          depositId: deposit._id,
          userId: deposit.user,
          amount: deposit.amount
        };
      }
      
      return {
        success: true,
        message: `Статус депозита обновлен на ${status}`,
        depositId: deposit._id
      };
      
    } catch (error) {
      console.error('Ошибка обработки webhook:', error);
      throw error;
    }
  }

  /**
   * Обновляет депозит данными из webhook
   * @param {Object} deposit - Объект депозита
   * @param {Object} webhookPayload - Данные из webhook payload
   */
  async updateDepositFromWebhook(deposit, webhookPayload) {
    try {
      // Обновляем cryptoBotData с данными из webhook
      deposit.cryptoBotData.webhookData = webhookPayload;
      
      if (webhookPayload.status === 'paid') {
        deposit.status = 'paid';
        deposit.cryptoBotData.paidAt = new Date(webhookPayload.paid_at);
        deposit.cryptoBotData.hash = webhookPayload.hash;
        deposit.processedAt = new Date();
        
        console.log(`Депозит ${deposit._id} помечен как оплаченный`);
      } else if (webhookPayload.status === 'expired') {
        deposit.status = 'expired';
        console.log(`Депозит ${deposit._id} помечен как истекший`);
      }
      
      await deposit.save();
      return deposit;
    } catch (error) {
      console.error('Ошибка обновления депозита:', error);
      throw error;
    }
  }

  /**
   * Зачисляет средства на баланс пользователя
   * @param {Object} deposit - Объект депозита
   */
  async creditUserBalance(deposit) {
    try {
      const user = await User.findById(deposit.user);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      console.log(`Зачисляем ${deposit.amount} USDT пользователю ${user._id}`);
      console.log(`Баланс до: ${user.balance} USDT`);
      
      // Обновляем баланс пользователя
      const oldBalance = user.balance;
      const newBalance = oldBalance + deposit.amount;
      
      user.balance = newBalance;
      user.lastActivity = new Date();
      await user.save();
      
      // Обновляем информацию о балансах в депозите
      deposit.balanceBefore = oldBalance;
      deposit.balanceAfter = newBalance;
      await deposit.save();
      
      console.log(`Баланс после: ${newBalance} USDT`);
      
      // Создаем транзакцию для учета
      const { Transaction } = require('../models');
      const transaction = new Transaction({
        user: user._id,
        type: 'deposit',
        amount: deposit.amount,
        status: 'completed',
        description: `Депозит через CryptoBot: ${deposit.invoiceId}`,
        balanceBefore: oldBalance,
        balanceAfter: newBalance,
        payment: {
          invoiceId: deposit.invoiceId,
          paymentMethod: 'cryptobot',
          externalReference: deposit.cryptoBotData.hash
        }
      });
      
      await transaction.save();
      
      console.log(`Баланс пользователя ${user._id} обновлен: ${oldBalance} -> ${newBalance} USDT`);
      
    } catch (error) {
      console.error('Ошибка зачисления средств:', error);
      throw error;
    }
  }

  /**
   * Верифицирует подпись webhook'а от CryptoBot
   * @param {Object} data - Данные webhook
   * @param {string} signature - Подпись
   * @returns {boolean} - Результат верификации
   */
  verifyWebhookSignature(data, signature) {
    if (!this.webhookSecret) return true; // Если secret не настроен, пропускаем проверку
    
    try {
      const dataString = JSON.stringify(data);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(dataString)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Ошибка верификации подписи:', error);
      return false;
    }
  }

  /**
   * Получает информацию о депозите по ID
   * @param {string} depositId - ID депозита
   * @returns {Object} - Информация о депозите
   */
  async getDepositInfo(depositId) {
    try {
      const deposit = await Deposit.findById(depositId).populate('user', 'telegramId username firstName lastName');
      if (!deposit) {
        throw new Error('Депозит не найден');
      }
      
      return {
        id: deposit._id,
        amount: deposit.amount,
        status: deposit.status,
        payUrl: deposit.cryptoBotData.payUrl,
        createdAt: deposit.createdAt,
        paidAt: deposit.cryptoBotData.paidAt,
        expiresAt: new Date(deposit.createdAt.getTime() + 60 * 60 * 1000),
        isExpired: deposit.isExpired,
        user: deposit.user
      };
    } catch (error) {
      console.error('Ошибка получения информации о депозите:', error);
      throw error;
    }
  }

  /**
   * Получает историю депозитов пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} params - Параметры фильтрации
   * @returns {Object} - История депозитов
   */
  async getUserDeposits(userId, params = {}) {
    try {
      const { limit = 20, skip = 0, status } = params;
      
      const query = { user: userId };
      if (status) {
        query.status = status;
      }
      
      const deposits = await Deposit.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(skip));
      
      const total = await Deposit.countDocuments(query);
      
      return {
        deposits: deposits.map(deposit => ({
          id: deposit._id,
          amount: deposit.amount,
          status: deposit.status,
          createdAt: deposit.createdAt,
          paidAt: deposit.cryptoBotData.paidAt,
          hash: deposit.cryptoBotData.hash
        })),
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Ошибка получения истории депозитов:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();