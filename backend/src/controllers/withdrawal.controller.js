// backend/src/controllers/withdrawal.controller.js
const { withdrawalService } = require('../services');

/**
 * Контроллер для управления выводами средств
 */
class WithdrawalController {
  /**
   * Создание запроса на вывод
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async createWithdrawal(req, res) {
    try {
      const { amount, recipient, recipientType, comment } = req.body;
      
      // Получаем информацию о пользователе из middleware аутентификации
      const userId = req.user._id;
      
      // Валидация входных данных
      if (!amount || !recipient || !recipientType) {
        return res.status(400).json({
          success: false,
          message: 'Укажите сумму, получателя и тип получателя'
        });
      }
      
      const withdrawalAmount = parseFloat(amount);
      
      if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректную сумму для вывода'
        });
      }
      
      // Валидация типа получателя
      if (!['username', 'wallet'].includes(recipientType)) {
        return res.status(400).json({
          success: false,
          message: 'Неверный тип получателя. Используйте "username" или "wallet"'
        });
      }
      
      // Подготавливаем метаданные
      const metadata = {
        source: 'web',
        userIp: req.ip || req.connection.remoteAddress,
        sessionId: req.sessionID,
        userAgent: req.get('User-Agent')
      };
      
      console.log(`WITHDRAWAL CONTROLLER: Создание запроса на вывод: пользователь=${userId}, сумма=${withdrawalAmount}`);
      
      // Создаем запрос на вывод через сервис
      const withdrawalData = await withdrawalService.createWithdrawal(userId, {
        amount: withdrawalAmount,
        recipient,
        recipientType,
        comment,
        metadata
      });
      
      res.status(201).json({
        success: true,
        message: 'Запрос на вывод успешно создан',
        data: withdrawalData
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка создания запроса на вывод:', error);
      
      // Возвращаем понятную ошибку пользователю
      let message = 'Не удалось создать запрос на вывод. Попробуйте позже.';
      
      if (error.message.includes('Недостаточно средств')) {
        message = error.message;
      } else if (error.message.includes('активный запрос')) {
        message = error.message;
      } else if (error.message.includes('Минимальная сумма')) {
        message = error.message;
      } else if (error.message.includes('Максимальная сумма')) {
        message = error.message;
      } else if (error.message.includes('username')) {
        message = error.message;
      } else if (error.message.includes('кошелька')) {
        message = error.message;
      } else if (error.message.includes('заблокирован')) {
        message = error.message;
      }
      
      res.status(400).json({
        success: false,
        message
      });
    }
  }

  /**
   * Получение информации о конкретном выводе
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getWithdrawalInfo(req, res) {
    try {
      const { withdrawalId } = req.params;
      const userId = req.user._id;
      
      if (!withdrawalId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID запроса на вывод'
        });
      }
      
      const withdrawalInfo = await withdrawalService.getWithdrawalInfo(withdrawalId);
      
      // Проверяем, что вывод принадлежит текущему пользователю
      if (withdrawalInfo.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }
      
      res.status(200).json({
        success: true,
        data: {
          id: withdrawalInfo._id,
          amount: withdrawalInfo.amount,
          recipient: withdrawalInfo.recipient,
          recipientType: withdrawalInfo.recipientType,
          status: withdrawalInfo.status,
          requiresApproval: withdrawalInfo.requiresApproval,
          createdAt: withdrawalInfo.createdAt,
          processedAt: withdrawalInfo.processedAt,
          rejectionReason: withdrawalInfo.rejectionReason,
          comment: withdrawalInfo.comment
        }
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка получения информации о выводе:', error);
      
      if (error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: 'Запрос на вывод не найден'
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Не удалось получить информацию о выводе'
      });
    }
  }

  /**
   * Получение истории выводов пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserWithdrawals(req, res) {
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
      
      const withdrawalsData = await withdrawalService.getUserWithdrawals(userId, params);
      
      res.status(200).json({
        success: true,
        data: {
          withdrawals: withdrawalsData.withdrawals.map(w => ({
            id: w._id,
            amount: w.amount,
            recipient: w.recipient,
            recipientType: w.recipientType,
            status: w.status,
            requiresApproval: w.requiresApproval,
            createdAt: w.createdAt,
            processedAt: w.processedAt,
            rejectionReason: w.rejectionReason
          })),
          pagination: {
            total: withdrawalsData.total,
            currentPage: withdrawalsData.currentPage,
            totalPages: withdrawalsData.totalPages,
            limit: params.limit,
            skip: params.skip
          }
        }
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка получения истории выводов:', error);
      
      res.status(400).json({
        success: false,
        message: 'Не удалось получить историю выводов'
      });
    }
  }

  /**
   * Проверка статуса вывода (для polling с фронтенда)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async checkWithdrawalStatus(req, res) {
    try {
      const { withdrawalId } = req.params;
      const userId = req.user._id;
      
      const withdrawalInfo = await withdrawalService.getWithdrawalInfo(withdrawalId);
      
      // Проверяем принадлежность пользователю
      if (withdrawalInfo.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }
      
      res.status(200).json({
        success: true,
        data: {
          id: withdrawalInfo._id,
          amount: withdrawalInfo.amount,
          status: withdrawalInfo.status,
          isCompleted: withdrawalInfo.status === 'completed',
          isRejected: withdrawalInfo.status === 'rejected',
          isFailed: withdrawalInfo.status === 'failed',
          processedAt: withdrawalInfo.processedAt,
          rejectionReason: withdrawalInfo.rejectionReason
        }
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка проверки статуса вывода:', error);
      
      if (error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: 'Запрос на вывод не найден'
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Не удалось проверить статус вывода'
      });
    }
  }

  /**
   * Отмена запроса на вывод (только для pending статуса)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async cancelWithdrawal(req, res) {
    try {
      const { withdrawalId } = req.params;
      const userId = req.user._id;
      
      const withdrawal = await withdrawalService.getWithdrawalInfo(withdrawalId);
      
      // Проверяем принадлежность пользователю
      if (withdrawal.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }
      
      // Можно отменить только pending запросы
      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Нельзя отменить запрос в статусе: ' + withdrawal.status
        });
      }
      
      // Отменяем через rejection с причиной "Отменено пользователем"
      await withdrawalService.rejectWithdrawal(withdrawalId, userId, 'Отменено пользователем');
      
      res.status(200).json({
        success: true,
        message: 'Запрос на вывод отменен, средства возвращены на баланс'
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка отмены вывода:', error);
      
      res.status(400).json({
        success: false,
        message: 'Не удалось отменить запрос на вывод'
      });
    }
  }

  // === МЕТОДЫ ДЛЯ АДМИНИСТРАТОРОВ ===

  /**
   * Получение списка выводов, требующих одобрения
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getPendingApprovals(req, res) {
    try {
      const pendingWithdrawals = await withdrawalService.getPendingApprovals();
      
      res.status(200).json({
        success: true,
        data: {
          withdrawals: pendingWithdrawals.map(w => ({
            id: w._id,
            user: {
              id: w.user._id,
              telegramId: w.user.telegramId,
              username: w.user.username,
              name: `${w.user.firstName} ${w.user.lastName}`.trim(),
              balance: w.user.balance
            },
            amount: w.amount,
            recipient: w.recipient,
            recipientType: w.recipientType,
            comment: w.comment,
            createdAt: w.createdAt,
            metadata: w.metadata
          })),
          total: pendingWithdrawals.length
        }
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка получения pending выводов:', error);
      
      res.status(400).json({
        success: false,
        message: 'Не удалось получить список выводов для одобрения'
      });
    }
  }

  /**
   * Одобрение запроса на вывод
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async approveWithdrawal(req, res) {
    try {
      const { withdrawalId } = req.params;
      const adminId = req.user._id;
      
      await withdrawalService.approveWithdrawal(withdrawalId, adminId);
      
      res.status(200).json({
        success: true,
        message: 'Запрос на вывод одобрен и отправлен на обработку'
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка одобрения вывода:', error);
      
      res.status(400).json({
        success: false,
        message: error.message || 'Не удалось одобрить запрос на вывод'
      });
    }
  }

  /**
   * Отклонение запроса на вывод
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async rejectWithdrawal(req, res) {
    try {
      const { withdrawalId } = req.params;
      const { reason } = req.body;
      const adminId = req.user._id;
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Укажите причину отклонения'
        });
      }
      
      await withdrawalService.rejectWithdrawal(withdrawalId, adminId, reason);
      
      res.status(200).json({
        success: true,
        message: 'Запрос на вывод отклонен, средства возвращены пользователю'
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка отклонения вывода:', error);
      
      res.status(400).json({
        success: false,
        message: error.message || 'Не удалось отклонить запрос на вывод'
      });
    }
  }

  /**
   * Получение статистики по выводам
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getWithdrawalStats(req, res) {
    try {
      const { userId } = req.query;
      
      const stats = await withdrawalService.getWithdrawalStats(userId);
      
      res.status(200).json({
        success: true,
        data: {
          stats
        }
      });
      
    } catch (error) {
      console.error('WITHDRAWAL CONTROLLER: Ошибка получения статистики выводов:', error);
      
      res.status(400).json({
        success: false,
        message: 'Не удалось получить статистику выводов'
      });
    }
  }
}

module.exports = new WithdrawalController();