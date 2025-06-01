// backend/src/routes/admin-flexible-odds.routes.js - НОВЫЕ МАРШРУТЫ ДЛЯ ГИБКИХ КОЭФФИЦИЕНТОВ
const express = require('express');
const { adminAuthMiddleware } = require('../middleware');
const { Event, EventBet } = require('../models');

const router = express.Router();

// Применяем middleware для проверки админских прав
router.use(adminAuthMiddleware);

/**
 * GET /api/admin/events/flexible-odds-stats
 * Получить статистику гибких коэффициентов
 */
router.get('/events/flexible-odds-stats', async (req, res) => {
  try {
    console.log('ADMIN API: Запрос статистики гибких коэффициентов');
    
    // Общая статистика событий
    const [totalEvents, eventsWithFlexibleOdds] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ 'metadata.flexibleOddsStats.oddsRecalculations': { $gt: 0 } })
    ]);
    
    // Статистика пересчетов
    const recalculationStats = await Event.aggregate([
      {
        $match: {
          'metadata.flexibleOddsStats.oddsRecalculations': { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalRecalculations: { $sum: '$metadata.flexibleOddsStats.oddsRecalculations' },
          avgRecalculations: { $avg: '$metadata.flexibleOddsStats.oddsRecalculations' },
          maxRecalculations: { $max: '$metadata.flexibleOddsStats.oddsRecalculations' }
        }
      }
    ]);
    
    // Топ самых волатильных событий
    const topVolatileEvents = await Event.find({
      'metadata.flexibleOddsStats.oddsRecalculations': { $gt: 5 }
    })
    .select('title metadata.flexibleOddsStats.oddsRecalculations totalPool status')
    .sort({ 'metadata.flexibleOddsStats.oddsRecalculations': -1 })
    .limit(10)
    .lean();
    
    const stats = {
      totalEvents,
      eventsWithFlexibleOdds,
      flexibleOddsPercentage: totalEvents > 0 ? ((eventsWithFlexibleOdds / totalEvents) * 100).toFixed(1) : 0,
      totalRecalculations: recalculationStats[0]?.totalRecalculations || 0,
      avgRecalculationsPerEvent: recalculationStats[0]?.avgRecalculations || 0,
      maxRecalculationsInEvent: recalculationStats[0]?.maxRecalculations || 0,
      topVolatileEvents: topVolatileEvents.map(event => ({
        id: event._id,
        title: event.title,
        recalculations: event.metadata.flexibleOddsStats.oddsRecalculations,
        totalPool: event.totalPool,
        status: event.status
      }))
    };
    
    console.log('ADMIN API: Статистика гибких коэффициентов:', stats);
    
    res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('ADMIN API: Ошибка получения статистики гибких коэффициентов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики гибких коэффициентов'
    });
  }
});

/**
 * GET /api/admin/events/:eventId/odds-history
 * Получить историю коэффициентов для события
 */
router.get('/events/:eventId/odds-history', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('ADMIN API: Запрос истории коэффициентов для события:', eventId);
    
    const event = await Event.findById(eventId).lean();
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Событие не найдено'
      });
    }
    
    // Рассчитываем текущие коэффициенты
    const eventDoc = new Event(event);
    const currentOdds = eventDoc.calculateOdds();
    
    // Получаем статистику коэффициентов
    const oddsStatistics = eventDoc.getOddsStatistics();
    
    res.status(200).json({
      success: true,
      data: {
        event: {
          ...event,
          currentOdds
        },
        oddsStatistics
      }
    });
    
  } catch (error) {
    console.error('ADMIN API: Ошибка получения истории коэффициентов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения истории коэффициентов'
    });
  }
});

/**
 * GET /api/admin/events/flexible-odds-export
 * Экспорт подробной статистики гибких коэффициентов
 */
router.get('/events/flexible-odds-export', async (req, res) => {
  try {
    console.log('ADMIN API: Экспорт статистики гибких коэффициентов');
    
    // Общая статистика
    const [totalEvents, eventsWithFlexibleOdds] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ 'metadata.flexibleOddsStats.oddsRecalculations': { $gt: 0 } })
    ]);
    
    // Детальная статистика пересчетов
    const recalculationStats = await Event.aggregate([
      {
        $match: {
          'metadata.flexibleOddsStats.oddsRecalculations': { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalRecalculations: { $sum: '$metadata.flexibleOddsStats.oddsRecalculations' },
          avgRecalculations: { $avg: '$metadata.flexibleOddsStats.oddsRecalculations' },
          maxRecalculations: { $max: '$metadata.flexibleOddsStats.oddsRecalculations' },
          events: { $push: { title: '$title', recalculations: '$metadata.flexibleOddsStats.oddsRecalculations' } }
        }
      }
    ]);
    
    // Анализ выгоды игроков от гибких коэффициентов
    const benefitAnalysis = await EventBet.aggregate([
      {
        $match: {
          status: 'won',
          finalOdds: { $exists: true },
          oddsAtBet: { $exists: true }
        }
      },
      {
        $project: {
          oddsChange: { $subtract: ['$finalOdds', '$oddsAtBet'] },
          estimatedWin: 1,
          actualWin: 1,
          winDifference: { $subtract: ['$actualWin', '$estimatedWin'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          benefited: { $sum: { $cond: [{ $gt: ['$oddsChange', 0] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $lt: ['$oddsChange', 0] }, 1, 0] } },
          avgOddsChange: { $avg: '$oddsChange' },
          avgWinDifference: { $avg: '$winDifference' },
          totalWinDifference: { $sum: '$winDifference' }
        }
      }
    ]);
    
    // Топ событий
    const topEvents = await Event.find({
      'metadata.flexibleOddsStats.oddsRecalculations': { $gt: 5 }
    })
    .select('title metadata.flexibleOddsStats.oddsRecalculations totalPool status createdAt')
    .sort({ 'metadata.flexibleOddsStats.oddsRecalculations': -1 })
    .limit(20)
    .lean();
    
    const exportData = {
      generatedAt: new Date().toISOString(),
      totalEvents,
      eventsWithFlexibleOdds,
      flexibleOddsAdoptionRate: totalEvents > 0 ? ((eventsWithFlexibleOdds / totalEvents) * 100).toFixed(2) : 0,
      totalRecalculations: recalculationStats[0]?.totalRecalculations || 0,
      avgRecalculationsPerEvent: recalculationStats[0]?.avgRecalculations?.toFixed(2) || 0,
      maxRecalculationsInEvent: recalculationStats[0]?.maxRecalculations || 0,
      benefitAnalysis: benefitAnalysis[0] ? {
        totalBenefited: benefitAnalysis[0].benefited,
        totalLost: benefitAnalysis[0].lost,
        benefitRate: ((benefitAnalysis[0].benefited / benefitAnalysis[0].totalBets) * 100).toFixed(2),
        avgOddsChange: benefitAnalysis[0].avgOddsChange?.toFixed(4) || 0,
        avgDifference: benefitAnalysis[0].avgWinDifference?.toFixed(2) || 0,
        totalImpact: benefitAnalysis[0].totalWinDifference?.toFixed(2) || 0
      } : null,
      topEvents: topEvents.map(event => ({
        title: event.title,
        recalculations: event.metadata.flexibleOddsStats.oddsRecalculations,
        totalPool: event.totalPool,
        status: event.status,
        createdAt: event.createdAt
      }))
    };
    
    res.status(200).json({
      success: true,
      data: exportData
    });
    
  } catch (error) {
    console.error('ADMIN API: Ошибка экспорта статистики:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта статистики'
    });
  }
});

/**
 * POST /api/admin/events/:eventId/force-odds-recalculation
 * Принудительный пересчет коэффициентов (для отладки)
 */
router.post('/events/:eventId/force-odds-recalculation', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('ADMIN API: Принудительный пересчет коэффициентов для события:', eventId);
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Событие не найдено'
      });
    }
    
    if (event.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Пересчет возможен только для активных событий'
      });
    }
    
    // Рассчитываем коэффициенты и сохраняем в историю
    const oldOdds = event.calculateOdds();
    const newOdds = event.calculateOdds(true); // С сохранением в историю
    
    await event.save();
    
    res.status(200).json({
      success: true,
      message: 'Коэффициенты пересчитаны',
      data: {
        eventId: event._id,
        oldOdds,
        newOdds,
        recalculationsCount: event.metadata?.flexibleOddsStats?.oddsRecalculations || 0
      }
    });
    
  } catch (error) {
    console.error('ADMIN API: Ошибка принудительного пересчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка пересчета коэффициентов'
    });
  }
});

/**
 * GET /api/admin/events/odds-volatility-report
 * Отчет по волатильности коэффициентов
 */
router.get('/events/odds-volatility-report', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    console.log('ADMIN API: Отчет по волатильности коэффициентов за период:', period);
    
    // Определяем период
    const now = new Date();
    const periodStart = new Date();
    
    switch (period) {
      case 'day':
        periodStart.setDate(now.getDate() - 1);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      default:
        periodStart.setDate(now.getDate() - 7);
    }
    
    // События за период
    const events = await Event.find({
      createdAt: { $gte: periodStart },
      'metadata.flexibleOddsStats.oddsRecalculations': { $exists: true }
    })
    .select('title totalPool status metadata.flexibleOddsStats createdAt')
    .lean();
    
    // Анализ волатильности
    const volatilityAnalysis = {
      totalEvents: events.length,
      highVolatilityEvents: events.filter(e => e.metadata.flexibleOddsStats.oddsRecalculations > 10).length,
      mediumVolatilityEvents: events.filter(e => {
        const reCalc = e.metadata.flexibleOddsStats.oddsRecalculations;
        return reCalc >= 5 && reCalc <= 10;
      }).length,
      lowVolatilityEvents: events.filter(e => e.metadata.flexibleOddsStats.oddsRecalculations < 5).length,
      avgRecalculations: events.length > 0 ? 
        events.reduce((sum, e) => sum + e.metadata.flexibleOddsStats.oddsRecalculations, 0) / events.length : 0,
      maxRecalculations: Math.max(...events.map(e => e.metadata.flexibleOddsStats.oddsRecalculations || 0))
    };
    
    // Корреляция между пулом и волатильностью
    const poolVolatilityCorrelation = events.map(event => ({
      title: event.title,
      totalPool: event.totalPool,
      recalculations: event.metadata.flexibleOddsStats.oddsRecalculations,
      volatilityIndex: event.metadata.flexibleOddsStats.oddsRecalculations / (event.totalPool / 100 + 1)
    }));
    
    res.status(200).json({
      success: true,
      data: {
        period,
        periodStart,
        periodEnd: now,
        volatilityAnalysis,
        poolVolatilityCorrelation,
        recommendations: generateVolatilityRecommendations(volatilityAnalysis)
      }
    });
    
  } catch (error) {
    console.error('ADMIN API: Ошибка отчета по волатильности:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания отчета по волатильности'
    });
  }
});

/**
 * Генерирует рекомендации на основе анализа волатильности
 */
function generateVolatilityRecommendations(analysis) {
  const recommendations = [];
  
  if (analysis.avgRecalculations > 15) {
    recommendations.push({
      type: 'warning',
      message: 'Высокая средняя волатильность коэффициентов. Рассмотрите увеличение минимальной ставки.'
    });
  }
  
  if (analysis.highVolatilityEvents / analysis.totalEvents > 0.3) {
    recommendations.push({
      type: 'info',
      message: 'Более 30% событий имеют высокую волатильность. Это может указывать на активную торговлю.'
    });
  }
  
  if (analysis.lowVolatilityEvents / analysis.totalEvents > 0.7) {
    recommendations.push({
      type: 'success',
      message: 'Большинство событий имеют низкую волатильность. Стабильная система коэффициентов.'
    });
  }
  
  if (analysis.maxRecalculations > 50) {
    recommendations.push({
      type: 'warning',
      message: 'Обнаружено событие с экстремально высокой волатильностью. Проверьте на манипуляции.'
    });
  }
  
  return recommendations;
}

module.exports = router;
