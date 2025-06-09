// backend/src/controllers/monitoring.controller.js
const { balanceMonitoringService } = require('../services');
const logger = require('../utils/logger');

/**
 * Контроллер для мониторинга балансов
 */
class MonitoringController {
  /**
   * Запуск проверки балансов
   */
  async checkBalances(req, res) {
    try {
      logger.info('Запуск ручной проверки балансов');
      
      const result = await balanceMonitoringService.performBalanceReconciliation();
      
      res.json({
        success: true,
        message: 'Проверка балансов выполнена успешно',
        data: result
      });
    } catch (error) {
      logger.error('Ошибка проверки балансов:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка проверки балансов',
        error: error.message
      });
    }
  }

  /**
   * Получение статистики мониторинга
   */
  async getMonitoringStats(req, res) {
    try {
      const stats = balanceMonitoringService.getMonitoringStats();
      
      res.json({
        success: true,
        message: 'Статистика мониторинга получена',
        data: stats
      });
    } catch (error) {
      logger.error('Ошибка получения статистики мониторинга:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения статистики мониторинга',
        error: error.message
      });
    }
  }

  /**
   * Получение уведомлений мониторинга
   */
  async getNotifications(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      const notifications = balanceMonitoringService.getNotifications(parseInt(limit));
      
      res.json({
        success: true,
        message: 'Уведомления получены',
        data: {
          notifications,
          total: notifications.length
        }
      });
    } catch (error) {
      logger.error('Ошибка получения уведомлений:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения уведомлений',
        error: error.message
      });
    }
  }

  /**
   * Запуск автоматического мониторинга
   */
  async startMonitoring(req, res) {
    try {
      balanceMonitoringService.startMonitoring();
      
      res.json({
        success: true,
        message: 'Автоматический мониторинг запущен'
      });
    } catch (error) {
      logger.error('Ошибка запуска мониторинга:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка запуска мониторинга',
        error: error.message
      });
    }
  }

  /**
   * Остановка автоматического мониторинга
   */
  async stopMonitoring(req, res) {
    try {
      balanceMonitoringService.stopMonitoring();
      
      res.json({
        success: true,
        message: 'Автоматический мониторинг остановлен'
      });
    } catch (error) {
      logger.error('Ошибка остановки мониторинга:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка остановки мониторинга',
        error: error.message
      });
    }
  }

  /**
   * Обновление настроек мониторинга
   */
  async updateSettings(req, res) {
    try {
      const { alertThreshold, criticalThreshold } = req.body;

      if (alertThreshold === undefined || criticalThreshold === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Требуются параметры alertThreshold и criticalThreshold'
        });
      }

      if (alertThreshold < 0 || criticalThreshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'Пороговые значения должны быть положительными'
        });
      }

      if (alertThreshold >= criticalThreshold) {
        return res.status(400).json({
          success: false,
          message: 'Критический порог должен быть больше порога предупреждения'
        });
      }

      balanceMonitoringService.updateThresholds(alertThreshold, criticalThreshold);
      
      res.json({
        success: true,
        message: 'Настройки мониторинга обновлены',
        data: {
          alertThreshold,
          criticalThreshold
        }
      });
    } catch (error) {
      logger.error('Ошибка обновления настроек мониторинга:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления настроек мониторинга',
        error: error.message
      });
    }
  }

  /**
   * Получение баланса CryptoBot
   */
  async getCryptoBotBalance(req, res) {
    try {
      const balance = await balanceMonitoringService.getCryptoBotBalance();
      
      res.json({
        success: true,
        message: 'Баланс CryptoBot получен',
        data: {
          balance,
          currency: 'USDT',
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Ошибка получения баланса CryptoBot:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения баланса CryptoBot',
        error: error.message
      });
    }
  }

  /**
   * Получение системного баланса
   */
  async getSystemBalance(req, res) {
    try {
      const balance = await balanceMonitoringService.getSystemOperationalBalance();
      
      res.json({
        success: true,
        message: 'Системный баланс получен',
        data: {
          balance,
          currency: 'USDT',
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Ошибка получения системного баланса:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения системного баланса',
        error: error.message
      });
    }
  }
}

module.exports = new MonitoringController();