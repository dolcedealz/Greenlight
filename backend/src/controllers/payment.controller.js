// backend/src/controllers/payment.controller.js
const paymentService = require('../services/payment.service');

/**
 * Контроллер для управления платежами
 */
class PaymentController {
  /**
   * Создание депозита
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async createDeposit(req, res) {
    try {
      const { amount, description, referralCode } = req.body;
      
      // Получаем информацию о пользователе из middleware аутентификации
      const userId = req.user._id;
      
      // Валидация входных данных
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректную сумму для пополнения'
        });
      }
      
      const depositAmount = parseFloat(amount);
      
      // Проверяем лимиты
      if (depositAmount < 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Минимальная сумма пополнения: 0.01 USDT'
        });
      }
      
      if (depositAmount > 10000) {
        return res.status(400).json({
          success: false,
          message: 'Максимальная сумма пополнения: 10000 USDT'
        });
      }
      
      // Подготавливаем метаданные
      const metadata = {
        source: 'web',
        userIp: req.ip || req.connection.remoteAddress,
        sessionId: req.sessionID,
        description: description || `Пополнение баланса на ${depositAmount} USDT`,
        referralCode: referralCode || null
      };
      
      console.log(`Создание депозита: пользователь=${userId}, сумма=${depositAmount}`);
      
      // Создаем депозит через сервис
      const depositData = await paymentService.createDeposit(userId, depositAmount, metadata);
      
      res.status(201).json({
        success: true,
        message: 'Депозит успешно создан',
        data: {
          depositId: depositData.depositId,
          amount: depositData.amount,
          payUrl: depositData.payUrl,
          qrCodeUrl: depositData.qrCodeUrl,
          expiresAt: depositData.expiresAt,
          status: depositData.status,
          invoiceId: depositData.invoiceId
        }
      });
      
    } catch (error) {
      console.error('Ошибка создания депозита:', error);
      
      // Возвращаем понятную ошибку пользователю
      let message = 'Не удалось создать депозит. Попробуйте позже.';
      
      if (error.message.includes('CryptoBot API Error')) {
        message = 'Ошибка платежной системы. Попробуйте позже.';
      } else if (error.message.includes('Пользователь не найден')) {
        message = 'Пользователь не найден';
      } else if (error.message.includes('Сумма должна быть')) {
        message = error.message;
      }
      
      res.status(400).json({
        success: false,
        message
      });
    }
  }

  /**
   * Обработка webhook от CryptoBot - ИСПРАВЛЕНО с улучшенным логированием
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async processWebhook(req, res) {
    try {
      console.log('=== WEBHOOK ПОЛУЧЕН ОТ CRYPTOBOT ===');
      console.log('URL:', req.originalUrl);
      console.log('Method:', req.method);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Raw Body:', JSON.stringify(req.body, null, 2));
      console.log('==========================================');
      
      const webhookData = req.body;
      const signature = req.headers['crypto-pay-api-signature'];
      
      // ИСПРАВЛЕНО: Более гибкая валидация структуры webhook
      // CryptoBot может отправлять разные форматы данных
      let payloadData = null;
      
      if (webhookData && webhookData.payload) {
        // Формат: { update_type: "invoice_paid", payload: { ... } }
        payloadData = webhookData.payload;
        console.log('WEBHOOK: Обнаружен формат с payload');
      } else if (webhookData && webhookData.invoice_id) {
        // Формат: прямо данные инвойса { invoice_id: ..., status: ... }
        payloadData = webhookData;
        console.log('WEBHOOK: Обнаружен прямой формат данных');
      } else {
        console.warn('WEBHOOK: Некорректная структура данных');
        console.log('WEBHOOK: Ожидается либо { payload: {...} } либо { invoice_id: ... }');
        return res.status(400).json({
          success: false,
          message: 'Некорректные данные webhook'
        });
      }
      
      // Проверяем наличие обязательных полей в payload
      if (!payloadData.invoice_id) {
        console.warn('WEBHOOK: Отсутствует invoice_id в данных');
        return res.status(400).json({
          success: false,
          message: 'Отсутствует invoice_id'
        });
      }
      
      // Проверяем тип события (если присутствует)
      if (webhookData.update_type && webhookData.update_type !== 'invoice_paid') {
        console.log(`WEBHOOK: Игнорируем событие типа: ${webhookData.update_type}`);
        return res.status(200).json({
          success: true,
          message: `Событие ${webhookData.update_type} обработано`
        });
      }
      
      console.log(`WEBHOOK: Обрабатываем инвойс: ${payloadData.invoice_id}`);
      console.log(`WEBHOOK: Статус инвойса: ${payloadData.status}`);
      console.log(`WEBHOOK: Сумма: ${payloadData.amount} ${payloadData.asset}`);
      
      // Обрабатываем webhook через сервис - передаем payload
      const result = await paymentService.processWebhook(payloadData, signature);
      
      if (result.success) {
        console.log(`WEBHOOK: Успешно обработан - ${result.message}`);
        
        // Если депозит был успешно обработан, можем отправить уведомление пользователю
        if (result.userId && result.amount) {
          console.log(`WEBHOOK: Пользователь ${result.userId} пополнил баланс на ${result.amount} USDT`);
          
          // TODO: Здесь можно добавить отправку уведомления через Telegram Bot
          // await notifyUserAboutDeposit(result.userId, result.amount);
        }
      } else {
        console.warn(`WEBHOOK: Ошибка обработки - ${result.message}`);
      }
      
      // Всегда возвращаем успешный ответ CryptoBot, чтобы они не повторяли webhook
      res.status(200).json({
        success: true,
        message: result.message || 'Webhook обработан'
      });
      
    } catch (error) {
      console.error('WEBHOOK: Критическая ошибка обработки:', error);
      console.error('WEBHOOK: Stack trace:', error.stack);
      
      // Возвращаем ошибку CryptoBot только в критических случаях
      if (error.message.includes('Неверная подпись')) {
        return res.status(401).json({
          success: false,
          message: 'Неверная подпись webhook'
        });
      }
      
      // В остальных случаях возвращаем успех, чтобы CryptoBot не повторял запрос
      res.status(200).json({
        success: true,
        message: 'Webhook получен, обработка отложена'
      });
    }
  }

  /**
   * Получение информации о депозите
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getDepositInfo(req, res) {
    try {
      const { depositId } = req.params;
      const userId = req.user._id;
      
      if (!depositId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID депозита'
        });
      }
      
      const depositInfo = await paymentService.getDepositInfo(depositId);
      
      // Проверяем, что депозит принадлежит текущему пользователю
      if (depositInfo.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }
      
      res.status(200).json({
        success: true,
        data: {
          id: depositInfo.id,
          amount: depositInfo.amount,
          status: depositInfo.status,
          payUrl: depositInfo.payUrl,
          createdAt: depositInfo.createdAt,
          paidAt: depositInfo.paidAt,
          expiresAt: depositInfo.expiresAt,
          isExpired: depositInfo.isExpired
        }
      });
      
    } catch (error) {
      console.error('Ошибка получения информации о депозите:', error);
      
      if (error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: 'Депозит не найден'
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Не удалось получить информацию о депозите'
      });
    }
  }

  /**
   * Получение истории депозитов пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserDeposits(req, res) {
    try {
      const userId = req.user._id;
      const { limit, skip, status } = req.query;
      
      const params = {
        limit: limit ? parseInt(limit) : 20,
        skip: skip ? parseInt(skip) : 0,
        status: status || null
      };
      
      // Валидация параметров
      if (params.limit > 100) {
        params.limit = 100; // Максимум 100 записей за раз
      }
      
      const depositsData = await paymentService.getUserDeposits(userId, params);
      
      res.status(200).json({
        success: true,
        data: {
          deposits: depositsData.deposits,
          pagination: {
            total: depositsData.total,
            currentPage: depositsData.currentPage,
            totalPages: depositsData.totalPages,
            limit: params.limit,
            skip: params.skip
          }
        }
      });
      
    } catch (error) {
      console.error('Ошибка получения истории депозитов:', error);
      
      res.status(400).json({
        success: false,
        message: 'Не удалось получить историю депозитов'
      });
    }
  }

  /**
   * Проверка статуса депозита (для polling с фронтенда)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async checkDepositStatus(req, res) {
    try {
      const { depositId } = req.params;
      const userId = req.user._id;
      
      console.log(`API: Проверка статуса депозита ${depositId} для пользователя ${userId}`);
      
      const depositInfo = await paymentService.getDepositInfo(depositId);
      
      // Проверяем принадлежность депозита пользователю
      if (depositInfo.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }
      
      res.status(200).json({
        success: true,
        data: {
          id: depositInfo.id,
          amount: depositInfo.amount,
          status: depositInfo.status,
          isPaid: depositInfo.status === 'paid',
          isExpired: depositInfo.isExpired,
          paidAt: depositInfo.paidAt,
          createdAt: depositInfo.createdAt
        }
      });
      
    } catch (error) {
      console.error('Ошибка проверки статуса депозита:', error);
      
      if (error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: 'Депозит не найден'
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Не удалось проверить статус депозита'
      });
    }
  }

  /**
   * Отмена депозита (если еще не оплачен)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async cancelDeposit(req, res) {
    try {
      const { depositId } = req.params;
      const userId = req.user._id;
      
      const Deposit = require('../models/deposit.model');
      
      const deposit = await Deposit.findById(depositId);
      
      if (!deposit) {
        return res.status(404).json({
          success: false,
          message: 'Депозит не найден'
        });
      }
      
      // Проверяем принадлежность депозита пользователю
      if (deposit.user.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }
      
      // Можно отменить только pending депозиты
      if (deposit.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Нельзя отменить депозит в статусе: ' + deposit.status
        });
      }
      
      // Обновляем статус на отмененный
      deposit.status = 'expired';
      await deposit.save();
      
      res.status(200).json({
        success: true,
        message: 'Депозит отменен'
      });
      
    } catch (error) {
      console.error('Ошибка отмены депозита:', error);
      
      res.status(400).json({
        success: false,
        message: 'Не удалось отменить депозит'
      });
    }
  }
}

module.exports = new PaymentController();