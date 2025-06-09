// backend/src/services/balance-monitoring.service.js
const axios = require('axios');
const cron = require('node-cron');
const { CasinoFinance } = require('../models');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BALANCE_MONITORING');

class BalanceMonitoringService {
  constructor() {
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    this.adminNotifications = [];
    this.isMonitoring = false;
    this.lastCheckTime = null;
    this.alertThreshold = 0.01; // 0.01 USDT минимальное расхождение для алерта
    this.criticalThreshold = 1.0; // 1.0 USDT критическое расхождение
  }

  /**
   * Получает баланс CryptoBot
   */
  async getCryptoBotBalance() {
    try {
      if (!this.cryptoBotToken) {
        logger.warn('CryptoBot токен не настроен - баланс недоступен');
        return {
          available: 0,
          onhold: 0,
          total: 0,
          warning: 'CryptoBot токен не настроен'
        };
      }

      const response = await axios.get('https://pay.crypt.bot/api/getBalance', {
        headers: {
          'Crypto-Pay-API-Token': this.cryptoBotToken
        }
      });

      if (!response.data.ok) {
        throw new Error(`CryptoBot API ошибка: ${response.data.error?.name || 'Неизвестная ошибка'}`);
      }

      // Ищем USDT баланс
      const usdtBalance = response.data.result.find(balance => balance.currency_code === 'USDT');
      if (!usdtBalance) {
        throw new Error('USDT баланс не найден в CryptoBot');
      }

      return parseFloat(usdtBalance.available);
    } catch (error) {
      logger.error('Ошибка получения баланса CryptoBot:', error);
      throw error;
    }
  }

  /**
   * Получает ожидаемый баланс системы (оперативный + пользователи)
   */
  async getExpectedSystemBalance() {
    try {
      const casinoFinance = await CasinoFinance.findOne().sort({ createdAt: -1 });
      if (!casinoFinance) {
        throw new Error('Данные казино финансов не найдены');
      }

      // Ожидаемый баланс CryptoBot = Оперативный баланс + Баланс пользователей
      return casinoFinance.operationalBalance + casinoFinance.totalUserBalance;
    } catch (error) {
      logger.error('Ошибка получения ожидаемого баланса системы:', error);
      throw error;
    }
  }

  /**
   * Выполняет сверку балансов
   */
  async performBalanceReconciliation() {
    try {
      logger.info('Начинаем сверку балансов...');

      const [cryptoBotBalanceData, expectedSystemBalance] = await Promise.all([
        this.getCryptoBotBalance(),
        this.getExpectedSystemBalance()
      ]);

      const cryptoBotBalance = cryptoBotBalanceData.total || cryptoBotBalanceData;

      const difference = Math.abs(cryptoBotBalance - expectedSystemBalance);
      const discrepancyPercent = expectedSystemBalance > 0 ? (difference / expectedSystemBalance) * 100 : 100;

      const reconciliationResult = {
        timestamp: new Date(),
        cryptoBotBalance,
        expectedSystemBalance,
        difference,
        discrepancyPercent: Math.round(discrepancyPercent * 100) / 100,
        status: this.getReconciliationStatus(difference),
        details: this.generateReconciliationDetails(cryptoBotBalance, expectedSystemBalance, difference)
      };

      this.lastCheckTime = new Date();

      // Логируем результат
      logger.info(`Сверка балансов завершена:`, {
        cryptoBot: cryptoBotBalance,
        expectedSystem: expectedSystemBalance,
        difference: difference,
        status: reconciliationResult.status
      });

      // Отправляем уведомления при необходимости
      await this.handleReconciliationResult(reconciliationResult);

      return reconciliationResult;

    } catch (error) {
      logger.error('Ошибка сверки балансов:', error);
      
      // Уведомляем админов об ошибке мониторинга
      await this.sendErrorNotification(error);
      
      throw error;
    }
  }

  /**
   * Определяет статус сверки на основе расхождения
   */
  getReconciliationStatus(difference) {
    if (difference <= this.alertThreshold) {
      return 'NORMAL';
    } else if (difference <= this.criticalThreshold) {
      return 'WARNING';
    } else {
      return 'CRITICAL';
    }
  }

  /**
   * Генерирует детали сверки
   */
  generateReconciliationDetails(cryptoBotBalance, expectedSystemBalance, difference) {
    const details = {
      balanceComparison: {
        higher: cryptoBotBalance > expectedSystemBalance ? 'CryptoBot' : 'System',
        lower: cryptoBotBalance < expectedSystemBalance ? 'CryptoBot' : 'System'
      },
      possibleCauses: []
    };

    if (difference > this.alertThreshold) {
      if (cryptoBotBalance > expectedSystemBalance) {
        details.possibleCauses.push('Возможны незафиксированные депозиты в системе');
        details.possibleCauses.push('Проблемы с обработкой входящих платежей');
        details.possibleCauses.push('Комиссии CryptoBot не учтены корректно');
      } else {
        details.possibleCauses.push('Возможны проблемы с выводами средств');
        details.possibleCauses.push('Ошибки в расчете балансов пользователей');
        details.possibleCauses.push('Незавершенные транзакции');
        details.possibleCauses.push('Фантомные балансы у пользователей');
      }
    }

    return details;
  }

  /**
   * Обрабатывает результат сверки и отправляет уведомления
   */
  async handleReconciliationResult(result) {
    if (result.status === 'NORMAL') {
      // Для нормального состояния уведомления не отправляем
      return;
    }

    try {
      if (result.status === 'WARNING') {
        await this.sendWarningNotification(result);
      } else if (result.status === 'CRITICAL') {
        await this.sendCriticalNotification(result);
      }
    } catch (error) {
      logger.error('Ошибка отправки уведомления о сверке:', error);
    }
  }

  /**
   * Отправляет предупреждающее уведомление
   */
  async sendWarningNotification(result) {
    const message = this.formatWarningMessage(result);
    await this.sendAdminNotification(message, 'warning');
  }

  /**
   * Отправляет критическое уведомление
   */
  async sendCriticalNotification(result) {
    const message = this.formatCriticalMessage(result);
    await this.sendAdminNotification(message, 'critical');
  }

  /**
   * Отправляет уведомление об ошибке мониторинга
   */
  async sendErrorNotification(error) {
    const message = 
      `🚨 *ОШИБКА МОНИТОРИНГА БАЛАНСОВ*\n\n` +
      `❌ Не удалось выполнить сверку балансов\n` +
      `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n` +
      `📋 Ошибка: ${error.message}\n\n` +
      `⚠️ Требуется проверка системы мониторинга!`;

    await this.sendAdminNotification(message, 'error');
  }

  /**
   * Форматирует предупреждающее сообщение
   */
  formatWarningMessage(result) {
    const cryptoBotBalance = result.cryptoBotBalance ?? 0;
    const systemBalance = result.systemBalance ?? 0;
    const difference = result.difference ?? 0;
    const discrepancyPercent = result.discrepancyPercent ?? 0;
    const possibleCauses = result.details?.possibleCauses || [];
    
    return (
      `⚠️ *ПРЕДУПРЕЖДЕНИЕ: РАСХОЖДЕНИЕ БАЛАНСОВ*\n\n` +
      `💰 CryptoBot: ${cryptoBotBalance.toFixed(2)} USDT\n` +
      `🏦 Система: ${systemBalance.toFixed(2)} USDT\n` +
      `📊 Расхождение: ${difference.toFixed(2)} USDT (${discrepancyPercent}%)\n` +
      `🕐 Время проверки: ${result.timestamp?.toLocaleString?.('ru-RU') || 'Неизвестно'}\n\n` +
      `🔍 Возможные причины:\n${possibleCauses.map(cause => `• ${cause}`).join('\n')}\n\n` +
      `📈 Рекомендуется проверить последние транзакции и провести ручную сверку.`
    );
  }

  /**
   * Форматирует критическое сообщение
   */
  formatCriticalMessage(result) {
    return (
      `🚨 *КРИТИЧЕСКОЕ: СЕРЬЕЗНОЕ РАСХОЖДЕНИЕ БАЛАНСОВ*\n\n` +
      `💰 CryptoBot: ${result.cryptoBotBalance.toFixed(2)} USDT\n` +
      `🏦 Система: ${result.systemBalance.toFixed(2)} USDT\n` +
      `📊 Расхождение: ${result.difference.toFixed(2)} USDT (${result.discrepancyPercent}%)\n` +
      `🕐 Время проверки: ${result.timestamp.toLocaleString('ru-RU')}\n\n` +
      `🔍 Возможные причины:\n${result.details.possibleCauses.map(cause => `• ${cause}`).join('\n')}\n\n` +
      `🚨 ТРЕБУЕТСЯ НЕМЕДЛЕННАЯ ПРОВЕРКА!\n` +
      `⚠️ Рекомендуется временно приостановить депозиты и выводы до выяснения причин.`
    );
  }

  /**
   * Отправляет уведомление администраторам
   */
  async sendAdminNotification(message, type = 'info') {
    try {
      // Здесь будет интеграция с системой уведомлений админки
      // Пока что логируем и сохраняем в массив для последующей отправки
      
      const notification = {
        id: Date.now(),
        type,
        message,
        timestamp: new Date(),
        sent: false
      };

      this.adminNotifications.push(notification);

      // Логируем уведомление
      const logLevel = type === 'critical' ? 'error' : type === 'warning' ? 'warn' : 'info';
      logger[logLevel](`BALANCE MONITORING [${type.toUpperCase()}]:`, message);

      // TODO: Интеграция с Telegram Bot для отправки в админ-чат
      // await this.sendTelegramNotification(message);

      return notification;
    } catch (error) {
      logger.error('Ошибка отправки админ-уведомления:', error);
    }
  }

  /**
   * Запускает автоматический мониторинг
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Мониторинг балансов уже запущен');
      return;
    }

    logger.info('Запуск автоматического мониторинга балансов...');

    // Проверка каждые 30 минут
    cron.schedule('*/30 * * * *', async () => {
      try {
        await this.performBalanceReconciliation();
      } catch (error) {
        logger.error('Ошибка в автоматической сверке балансов:', error);
      }
    });

    // Ежедневный детальный отчет в 09:00
    cron.schedule('0 9 * * *', async () => {
      try {
        const result = await this.performBalanceReconciliation();
        await this.sendDailyReport(result);
      } catch (error) {
        logger.error('Ошибка создания ежедневного отчета:', error);
      }
    });

    this.isMonitoring = true;
    logger.info('Автоматический мониторинг балансов запущен');
  }

  /**
   * Останавливает мониторинг
   */
  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('Автоматический мониторинг балансов остановлен');
  }

  /**
   * Отправляет ежедневный отчет
   */
  async sendDailyReport(reconciliationResult) {
    const report = 
      `📊 *ЕЖЕДНЕВНЫЙ ОТЧЕТ МОНИТОРИНГА БАЛАНСОВ*\n\n` +
      `📅 Дата: ${new Date().toLocaleDateString('ru-RU')}\n` +
      `🕐 Время последней проверки: ${this.lastCheckTime?.toLocaleString('ru-RU') || 'Не выполнялась'}\n\n` +
      `💰 CryptoBot баланс: ${reconciliationResult.cryptoBotBalance.toFixed(2)} USDT\n` +
      `🏦 Системный баланс: ${reconciliationResult.systemBalance.toFixed(2)} USDT\n` +
      `📊 Статус: ${this.getStatusEmoji(reconciliationResult.status)} ${reconciliationResult.status}\n\n` +
      `📈 Количество уведомлений за день: ${this.adminNotifications.filter(n => n.timestamp > new Date(Date.now() - 24*60*60*1000)).length}`;

    await this.sendAdminNotification(report, 'daily_report');
  }

  /**
   * Получает эмодзи для статуса
   */
  getStatusEmoji(status) {
    switch (status) {
      case 'NORMAL': return '✅';
      case 'WARNING': return '⚠️';
      case 'CRITICAL': return '🚨';
      default: return '❓';
    }
  }

  /**
   * Получает все уведомления
   */
  getNotifications(limit = 50) {
    return this.adminNotifications
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Получает статистику мониторинга
   */
  getMonitoringStats() {
    const now = new Date();
    const last24h = new Date(now - 24*60*60*1000);
    const last7d = new Date(now - 7*24*60*60*1000);

    const notificationsLast24h = this.adminNotifications.filter(n => n.timestamp > last24h);
    const notificationsLast7d = this.adminNotifications.filter(n => n.timestamp > last7d);

    return {
      isActive: this.isMonitoring,
      lastCheckTime: this.lastCheckTime,
      totalNotifications: this.adminNotifications.length,
      notificationsLast24h: notificationsLast24h.length,
      notificationsLast7d: notificationsLast7d.length,
      criticalAlertsLast24h: notificationsLast24h.filter(n => n.type === 'critical').length,
      warningAlertsLast24h: notificationsLast24h.filter(n => n.type === 'warning').length,
      thresholds: {
        alert: this.alertThreshold,
        critical: this.criticalThreshold
      }
    };
  }

  /**
   * Обновляет пороговые значения
   */
  updateThresholds(alertThreshold, criticalThreshold) {
    this.alertThreshold = alertThreshold;
    this.criticalThreshold = criticalThreshold;
    
    logger.info(`Пороговые значения обновлены: Alert=${alertThreshold}, Critical=${criticalThreshold}`);
  }
}

module.exports = new BalanceMonitoringService();