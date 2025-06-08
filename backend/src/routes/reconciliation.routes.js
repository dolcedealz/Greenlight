// backend/src/routes/reconciliation.routes.js
const express = require('express');
const router = express.Router();
const balanceReconciliationService = require('../services/balance-reconciliation.service');

/**
 * @route GET /api/reconciliation/status
 * @desc Получить текущий статус сверки балансов
 * @access Admin
 */
router.get('/status', async (req, res) => {
  try {
    // Получаем последний отчет
    const history = balanceReconciliationService.getReconciliationHistory(1);
    const lastReport = history[0];

    if (!lastReport) {
      return res.status(200).json({
        success: true,
        message: 'Сверка еще не проводилась',
        data: {
          status: 'never_run',
          lastReconciliation: null,
          recommendations: ['Запустите первую сверку балансов']
        }
      });
    }

    // Определяем актуальность последней сверки
    const hoursSinceLastCheck = (Date.now() - new Date(lastReport.timestamp).getTime()) / (1000 * 60 * 60);
    const isStale = hoursSinceLastCheck > 2; // Считаем устаревшей через 2 часа

    res.status(200).json({
      success: true,
      data: {
        status: lastReport.status,
        lastReconciliation: lastReport.timestamp,
        hoursSinceLastCheck: Math.round(hoursSinceLastCheck * 100) / 100,
        isStale,
        severity: lastReport.discrepancies?.severity || 'unknown',
        discrepancy: lastReport.discrepancies?.discrepancy || 0,
        cryptoBotBalance: lastReport.cryptoBot?.total || 0,
        expectedBalance: lastReport.expected?.expectedBalance || 0,
        recommendations: lastReport.recommendations || []
      }
    });

  } catch (error) {
    console.error('Ошибка получения статуса сверки:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статуса сверки',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reconciliation/run
 * @desc Запустить сверку балансов вручную
 * @access Admin
 */
router.post('/run', async (req, res) => {
  try {
    console.log('🚀 Запуск ручной сверки балансов...');
    
    const report = await balanceReconciliationService.performReconciliation();

    res.status(200).json({
      success: true,
      message: 'Сверка балансов завершена',
      data: {
        id: report.id,
        timestamp: report.timestamp,
        duration: report.duration,
        status: report.status,
        discrepancy: report.discrepancies?.discrepancy || 0,
        severity: report.discrepancies?.severity || 'ok',
        cryptoBotBalance: report.cryptoBot?.total || 0,
        expectedBalance: report.expected?.expectedBalance || 0,
        recommendations: report.recommendations || []
      }
    });

  } catch (error) {
    console.error('Ошибка при ручной сверке:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при выполнении сверки',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reconciliation/history
 * @desc Получить историю сверок
 * @access Admin
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const history = balanceReconciliationService.getReconciliationHistory(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        history: history.map(report => ({
          id: report.id,
          timestamp: report.timestamp,
          duration: report.duration,
          status: report.status,
          discrepancy: report.discrepancies?.discrepancy || 0,
          severity: report.discrepancies?.severity || 'unknown',
          cryptoBotBalance: report.cryptoBot?.total || 0,
          expectedBalance: report.expected?.expectedBalance || 0,
          hasError: !!report.error
        })),
        total: history.length
      }
    });

  } catch (error) {
    console.error('Ошибка получения истории сверок:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения истории сверок',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reconciliation/report/:id
 * @desc Получить детальный отчет по конкретной сверке
 * @access Admin
 */
router.get('/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = balanceReconciliationService.exportReport(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Ошибка получения отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения отчета',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reconciliation/dashboard
 * @desc Получить данные для дашборда сверки
 * @access Admin
 */
router.get('/dashboard', async (req, res) => {
  try {
    const history = balanceReconciliationService.getReconciliationHistory(24); // Последние 24 сверки
    const lastReport = history[0];

    // Статистика по статусам
    const statusStats = history.reduce((acc, report) => {
      const status = report.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Статистика по серьезности расхождений
    const severityStats = history.reduce((acc, report) => {
      const severity = report.discrepancies?.severity || 'unknown';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});

    // Тренды расхождений
    const trends = history.map(report => ({
      timestamp: report.timestamp,
      discrepancy: report.discrepancies?.discrepancy || 0,
      severity: report.discrepancies?.severity || 'unknown'
    })).reverse(); // От старых к новым

    // Средние значения
    const avgDiscrepancy = history.length > 0 
      ? history.reduce((sum, report) => sum + Math.abs(report.discrepancies?.discrepancy || 0), 0) / history.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          lastCheck: lastReport?.timestamp || null,
          currentStatus: lastReport?.status || 'never_run',
          currentSeverity: lastReport?.discrepancies?.severity || 'unknown',
          currentDiscrepancy: lastReport?.discrepancies?.discrepancy || 0,
          avgDiscrepancy: Math.round(avgDiscrepancy * 100) / 100,
          totalChecks: history.length
        },
        stats: {
          byStatus: statusStats,
          bySeverity: severityStats
        },
        trends,
        recommendations: lastReport?.recommendations || [],
        alerts: this.generateAlerts(lastReport, history)
      }
    });

  } catch (error) {
    console.error('Ошибка получения данных дашборда:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения данных дашборда',
      error: error.message
    });
  }
});

/**
 * Генерирует алерты на основе анализа сверок
 */
function generateAlerts(lastReport, history) {
  const alerts = [];

  if (!lastReport) {
    alerts.push({
      type: 'warning',
      message: 'Сверка балансов еще не проводилась',
      action: 'Запустите первую сверку'
    });
    return alerts;
  }

  // Проверяем время последней сверки
  const hoursSinceLastCheck = (Date.now() - new Date(lastReport.timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastCheck > 2) {
    alerts.push({
      type: 'warning',
      message: `Последняя сверка была ${Math.round(hoursSinceLastCheck)} часов назад`,
      action: 'Запустите новую сверку'
    });
  }

  // Проверяем критические расхождения
  if (lastReport.discrepancies?.severity === 'critical') {
    alerts.push({
      type: 'error',
      message: `Критическое расхождение: ${lastReport.discrepancies.discrepancy.toFixed(2)} USDT`,
      action: 'Немедленно проверьте транзакции'
    });
  }

  // Проверяем тренды
  const recentReports = history.slice(0, 5);
  const hasConsistentIssues = recentReports.length >= 3 && 
    recentReports.every(r => r.discrepancies?.severity !== 'ok');

  if (hasConsistentIssues) {
    alerts.push({
      type: 'warning',
      message: 'Постоянные расхождения в последних сверках',
      action: 'Проведите детальный анализ системы'
    });
  }

  // Проверяем ошибки
  if (lastReport.status === 'error') {
    alerts.push({
      type: 'error',
      message: 'Последняя сверка завершилась с ошибкой',
      action: 'Проверьте логи и соединение с CryptoBot'
    });
  }

  return alerts;
}

module.exports = router;