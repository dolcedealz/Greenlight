// backend/src/services/balance-reconciliation.service.js
const axios = require('axios');
const { CasinoFinance, User, Deposit, Withdrawal } = require('../models');
const mongoose = require('mongoose');

class BalanceReconciliationService {
  constructor() {
    this.cryptoBotApiUrl = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    
    // Создаем axios instance для CryptoBot API
    this.api = axios.create({
      baseURL: this.cryptoBotApiUrl,
      headers: {
        'Crypto-Pay-API-Token': this.cryptoBotToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Пороги для предупреждений (в USDT)
    this.thresholds = {
      minor: 1,      // Мелкие расхождения до 1 USDT
      moderate: 10,  // Умеренные расхождения до 10 USDT
      critical: 100  // Критические расхождения свыше 100 USDT
    };

    // История сверок
    this.reconciliationHistory = [];
  }

  /**
   * Получает баланс USDT с CryptoBot
   */
  async getCryptoBotBalance() {
    try {
      console.log('🔍 RECONCILIATION: Получение баланса с CryptoBot...');
      
      const response = await this.api.get('/getBalance');
      
      if (!response.data.ok) {
        throw new Error(`CryptoBot API Error: ${response.data.error?.name || 'Unknown error'}`);
      }

      const balances = response.data.result;
      const usdtBalance = balances.find(b => b.currency_code === 'USDT');
      
      if (!usdtBalance) {
        console.warn('⚠️ RECONCILIATION: USDT баланс не найден в CryptoBot');
        return {
          available: 0,
          onhold: 0,
          total: 0
        };
      }

      const result = {
        available: parseFloat(usdtBalance.available),
        onhold: parseFloat(usdtBalance.onhold),
        total: parseFloat(usdtBalance.available) + parseFloat(usdtBalance.onhold)
      };

      console.log(`💰 RECONCILIATION: CryptoBot баланс - доступно: ${result.available} USDT, заморожено: ${result.onhold} USDT, всего: ${result.total} USDT`);
      
      return result;

    } catch (error) {
      console.error('❌ RECONCILIATION: Ошибка получения баланса CryptoBot:', error);
      throw new Error(`Не удалось получить баланс CryptoBot: ${error.message}`);
    }
  }

  /**
   * Рассчитывает ожидаемый баланс на основе наших данных
   */
  async calculateExpectedBalance() {
    try {
      console.log('📊 RECONCILIATION: Расчет ожидаемого баланса...');

      // Получаем финансовую статистику
      const finance = await CasinoFinance.getInstance();

      // Рассчитываем общий баланс пользователей (основной + реферальный)
      const userBalanceResult = await User.aggregate([
        { $match: { isBlocked: false } },
        { 
          $group: { 
            _id: null, 
            regularBalance: { $sum: '$balance' },
            referralBalance: { $sum: '$referralStats.referralBalance' }
          } 
        }
      ]);

      const regularBalance = userBalanceResult[0]?.regularBalance || 0;
      const referralBalance = userBalanceResult[0]?.referralBalance || 0;
      const totalUserBalance = regularBalance + referralBalance;

      // Суммируем все успешные депозиты
      const totalDepositsResult = await Deposit.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalDeposits = totalDepositsResult[0]?.total || 0;

      // Суммируем все успешные выводы пользователей
      const totalWithdrawalsResult = await Withdrawal.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalWithdrawals = totalWithdrawalsResult[0]?.total || 0;

      // Ожидаемый баланс = Депозиты - Выводы пользователей - Выводы владельца
      const expectedBalance = totalDeposits - totalWithdrawals - (finance.totalOwnerWithdrawals || 0);

      console.log('📈 RECONCILIATION: Расчет баланса:');
      console.log(`  • Баланс пользователей (основной): ${regularBalance.toFixed(2)} USDT`);
      console.log(`  • Баланс пользователей (реферальный): ${referralBalance.toFixed(2)} USDT`);
      console.log(`  • Общий баланс пользователей: ${totalUserBalance.toFixed(2)} USDT`);
      console.log(`  • Оперативный баланс казино: ${finance.operationalBalance.toFixed(2)} USDT`);
      console.log(`  • Всего депозитов: ${totalDeposits.toFixed(2)} USDT`);
      console.log(`  • Выводы пользователей: ${totalWithdrawals.toFixed(2)} USDT`);
      console.log(`  • Выводы владельца: ${(finance.totalOwnerWithdrawals || 0).toFixed(2)} USDT`);
      console.log(`  • Ожидаемый баланс CryptoBot: ${expectedBalance.toFixed(2)} USDT`);

      return {
        totalUserBalance,
        regularBalance,
        referralBalance,
        operationalBalance: finance.operationalBalance,
        totalDeposits,
        totalWithdrawals,
        totalOwnerWithdrawals: finance.totalOwnerWithdrawals || 0,
        expectedBalance
      };

    } catch (error) {
      console.error('❌ RECONCILIATION: Ошибка расчета ожидаемого баланса:', error);
      throw error;
    }
  }

  /**
   * Анализирует расхождения между балансами
   */
  analyzeDiscrepancies(cryptoBotBalance, expectedData) {
    const discrepancy = cryptoBotBalance.total - expectedData.expectedBalance;
    const discrepancyAbs = Math.abs(discrepancy);

    let severity = 'ok';
    let level = 'info';

    if (discrepancyAbs > this.thresholds.critical) {
      severity = 'critical';
      level = 'error';
    } else if (discrepancyAbs > this.thresholds.moderate) {
      severity = 'moderate';
      level = 'warn';
    } else if (discrepancyAbs > this.thresholds.minor) {
      severity = 'minor';
      level = 'warn';
    }

    // Анализируем возможные причины расхождений
    const analysis = [];

    if (discrepancy > 0) {
      analysis.push('На CryptoBot больше средств чем ожидается');
      analysis.push('Возможные причины: незавершенные депозиты, возвраты, ручные пополнения');
    } else if (discrepancy < 0) {
      analysis.push('На CryptoBot меньше средств чем ожидается');
      analysis.push('Возможные причины: незавершенные выводы, комиссии CryptoBot, технические ошибки');
    } else {
      analysis.push('Балансы полностью совпадают');
    }

    // Проверяем логику балансов
    const logicIssues = [];
    
    if (expectedData.totalUserBalance > cryptoBotBalance.total) {
      logicIssues.push('КРИТИЧНО: Баланс пользователей превышает общий баланс CryptoBot');
    }

    if (expectedData.operationalBalance < 0 && cryptoBotBalance.total > expectedData.totalUserBalance) {
      logicIssues.push('Отрицательный оперативный баланс при достаточности средств');
    }

    return {
      discrepancy,
      discrepancyAbs,
      severity,
      level,
      analysis,
      logicIssues,
      percentage: expectedData.expectedBalance > 0 ? (discrepancyAbs / expectedData.expectedBalance * 100) : 0
    };
  }

  /**
   * Выполняет полную сверку балансов
   */
  async performReconciliation() {
    const reconciliationId = `reconciliation_${Date.now()}`;
    const startTime = new Date();

    try {
      console.log(`🔍 RECONCILIATION: Начало сверки балансов [${reconciliationId}]`);

      // 1. Получаем данные с CryptoBot
      const cryptoBotBalance = await this.getCryptoBotBalance();

      // 2. Рассчитываем ожидаемый баланс
      const expectedData = await this.calculateExpectedBalance();

      // 3. Анализируем расхождения
      const discrepancies = this.analyzeDiscrepancies(cryptoBotBalance, expectedData);

      // 4. Формируем отчет
      const report = {
        id: reconciliationId,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        cryptoBot: cryptoBotBalance,
        expected: expectedData,
        discrepancies,
        status: discrepancies.severity === 'ok' ? 'success' : 'warning',
        recommendations: this.generateRecommendations(discrepancies, expectedData, cryptoBotBalance)
      };

      // 5. Логируем результаты
      this.logReconciliationResults(report);

      // 6. Сохраняем в историю
      this.reconciliationHistory.unshift(report);
      if (this.reconciliationHistory.length > 100) {
        this.reconciliationHistory = this.reconciliationHistory.slice(0, 100);
      }

      // 7. Отправляем уведомления при критических расхождениях
      if (discrepancies.severity === 'critical') {
        await this.notifyAdmins(report);
      }

      console.log(`✅ RECONCILIATION: Сверка завершена [${reconciliationId}] - статус: ${report.status}`);

      return report;

    } catch (error) {
      console.error(`❌ RECONCILIATION: Ошибка при сверке [${reconciliationId}]:`, error);
      
      const errorReport = {
        id: reconciliationId,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        status: 'error',
        error: error.message,
        stack: error.stack
      };

      this.reconciliationHistory.unshift(errorReport);
      throw error;
    }
  }

  /**
   * Генерирует рекомендации на основе анализа
   */
  generateRecommendations(discrepancies, expectedData, cryptoBotBalance) {
    const recommendations = [];

    if (discrepancies.severity === 'critical') {
      recommendations.push('🚨 НЕМЕДЛЕННО проверьте все незавершенные транзакции');
      recommendations.push('🔍 Проведите ручную проверку истории операций CryptoBot');
      recommendations.push('⏸️ Рассмотрите временную приостановку выводов до выяснения причин');
    }

    if (discrepancies.severity === 'moderate') {
      recommendations.push('⚠️ Проверьте незавершенные депозиты и выводы за последние 24 часа');
      recommendations.push('📊 Запустите пересчет финансовой статистики');
    }

    if (discrepancies.logicIssues.length > 0) {
      recommendations.push('🔧 Обнаружены логические несоответствия - требуется анализ');
      discrepancies.logicIssues.forEach(issue => {
        recommendations.push(`   • ${issue}`);
      });
    }

    if (cryptoBotBalance.onhold > 0) {
      recommendations.push(`💰 На CryptoBot заморожено ${cryptoBotBalance.onhold} USDT - проверьте причины`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Балансы в норме, рекомендаций нет');
    }

    return recommendations;
  }

  /**
   * Логирует результаты сверки
   */
  logReconciliationResults(report) {
    const { discrepancies, cryptoBot, expected } = report;

    console.log('\n📋 ОТЧЕТ О СВЕРКЕ БАЛАНСОВ:');
    console.log(`🕐 Время: ${report.timestamp.toISOString()}`);
    console.log(`⏱️ Длительность: ${report.duration}ms`);
    console.log('');
    console.log('💰 БАЛАНСЫ:');
    console.log(`  CryptoBot (всего): ${cryptoBot.total.toFixed(2)} USDT`);
    console.log(`  CryptoBot (доступно): ${cryptoBot.available.toFixed(2)} USDT`);
    console.log(`  CryptoBot (заморожено): ${cryptoBot.onhold.toFixed(2)} USDT`);
    console.log(`  Ожидаемый: ${expected.expectedBalance.toFixed(2)} USDT`);
    console.log('');
    console.log('📊 РАСХОЖДЕНИЯ:');
    console.log(`  Разница: ${discrepancies.discrepancy > 0 ? '+' : ''}${discrepancies.discrepancy.toFixed(2)} USDT`);
    console.log(`  Процент: ${discrepancies.percentage.toFixed(2)}%`);
    console.log(`  Серьезность: ${discrepancies.severity.toUpperCase()}`);
    console.log('');
    console.log('🔍 АНАЛИЗ:');
    discrepancies.analysis.forEach(item => console.log(`  • ${item}`));
    console.log('');
    console.log('💡 РЕКОМЕНДАЦИИ:');
    report.recommendations.forEach(item => console.log(`  ${item}`));
    console.log('');
  }

  /**
   * Отправляет уведомления администраторам при критических расхождениях
   */
  async notifyAdmins(report) {
    try {
      // TODO: Интеграция с Telegram Bot для отправки уведомлений администраторам
      console.log('🚨 КРИТИЧЕСКОЕ РАСХОЖДЕНИЕ - требуется уведомление админов');
      
      const message = 
        `🚨 КРИТИЧЕСКОЕ РАСХОЖДЕНИЕ БАЛАНСОВ\n\n` +
        `💰 CryptoBot: ${report.cryptoBot.total.toFixed(2)} USDT\n` +
        `📊 Ожидаемый: ${report.expected.expectedBalance.toFixed(2)} USDT\n` +
        `📉 Разница: ${report.discrepancies.discrepancy.toFixed(2)} USDT\n\n` +
        `⚠️ Требуется немедленная проверка!\n` +
        `🕐 ${report.timestamp.toISOString()}`;

      console.log('📱 Сообщение для админов:', message);

      // Здесь можно добавить отправку в Telegram, Email и т.д.
      
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления админам:', error);
    }
  }

  /**
   * Получает историю сверок
   */
  getReconciliationHistory(limit = 10) {
    return this.reconciliationHistory.slice(0, limit);
  }

  /**
   * Запускает периодическую сверку
   */
  startPeriodicReconciliation(intervalMinutes = 60) {
    console.log(`🔄 RECONCILIATION: Запуск периодической сверки каждые ${intervalMinutes} минут`);
    
    // Выполняем первую сверку сразу
    this.performReconciliation().catch(error => {
      console.error('❌ Ошибка первой сверки:', error);
    });

    // Запускаем периодическую сверку
    const interval = setInterval(() => {
      this.performReconciliation().catch(error => {
        console.error('❌ Ошибка периодической сверки:', error);
      });
    }, intervalMinutes * 60 * 1000);

    return interval;
  }

  /**
   * Останавливает периодическую сверку
   */
  stopPeriodicReconciliation(interval) {
    if (interval) {
      clearInterval(interval);
      console.log('⏹️ RECONCILIATION: Периодическая сверка остановлена');
    }
  }

  /**
   * Экспортирует отчет для анализа
   */
  exportReport(reportId = null) {
    const report = reportId 
      ? this.reconciliationHistory.find(r => r.id === reportId)
      : this.reconciliationHistory[0];

    if (!report) {
      throw new Error('Отчет не найден');
    }

    return {
      ...report,
      exportedAt: new Date(),
      version: '1.0'
    };
  }
}

module.exports = new BalanceReconciliationService();