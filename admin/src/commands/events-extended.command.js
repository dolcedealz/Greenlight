// admin/src/commands/events-extended.command.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ ГИБКИХ КОЭФФИЦИЕНТОВ
const { Markup } = require('telegraf');
const axios = require('axios');

// API URL и токен
const apiUrl = process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Создаем axios instance
const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * Расширенные команды для управления событиями с гибкими коэффициентами
 */
const eventsExtendedCommands = {
  /**
   * Показать расширенное меню событий с поддержкой гибких коэффициентов
   */
  async showExtendedEventsMenu(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Список событий', 'events_list')],
      [Markup.button.callback('➕ Создать событие', 'events_create')],
      [
        Markup.button.callback('✅ Завершить событие', 'events_finish'),
        Markup.button.callback('⏰ Изменить время', 'events_edit_time')
      ],
      [
        Markup.button.callback('🎯 Установить исход', 'events_set_outcome'),
        Markup.button.callback('🔄 Досрочное завершение', 'events_early_finish')
      ],
      [
        Markup.button.callback('📊 Статистика коэффициентов', 'events_odds_stats'),
        Markup.button.callback('📈 История коэффициентов', 'events_odds_history')
      ],
      [Markup.button.callback('◀️ Назад', 'admin_menu')]
    ]);

    await ctx.editMessageText(
      '🔮 *Управление событиями с гибкими коэффициентами*\n\n' +
      '🔄 *Гибкие коэффициенты активны*\n' +
      'Финальные выплаты рассчитываются по коэффициентам на момент завершения события\n\n' +
      'Выберите действие:',
      {
        parse_mode: 'Markdown',
        ...keyboard
      }
    );
  },

  /**
   * Показать статистику коэффициентов
   */
  async showOddsStatistics(ctx) {
    try {
      console.log('ADMIN: Запрос статистики гибких коэффициентов');
      
      const response = await apiClient.get('/events/admin/flexible-odds-stats');
      
      if (!response.data.success) {
        return ctx.answerCbQuery('❌ Ошибка получения статистики');
      }
      
      const stats = response.data.data;
      
      let message = '📊 *Статистика гибких коэффициентов*\n\n';
      message += `🎯 Всего событий с коэффициентами: ${stats.totalEvents}\n`;
      message += `🔄 Общее количество пересчетов: ${stats.totalRecalculations}\n`;
      message += `📈 Среднее пересчетов на событие: ${stats.avgRecalculationsPerEvent.toFixed(1)}\n\n`;
      
      if (stats.topVolatileEvents && stats.topVolatileEvents.length > 0) {
        message += '🌪️ *Самые волатильные события:*\n';
        stats.topVolatileEvents.slice(0, 5).forEach((event, index) => {
          message += `${index + 1}. ${event.title} - ${event.recalculations} пересчетов\n`;
        });
        message += '\n';
      }
      
      message += '💡 *Преимущества гибких коэффициентов:*\n';
      message += '• Более справедливое распределение выплат\n';
      message += '• Автоматическое балансирование рисков\n';
      message += '• Повышенная вовлеченность игроков\n';
      message += '• Математическая точность расчетов';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'events_odds_stats')],
        [Markup.button.callback('◀️ Назад', 'events_menu')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения статистики коэффициентов:', error);
      await ctx.answerCbQuery('❌ Ошибка получения статистики');
    }
  },

  /**
   * Показать историю коэффициентов для события
   */
  async showOddsHistory(ctx) {
    ctx.session = ctx.session || {};
    ctx.session.oddsHistory = {
      step: 'eventId'
    };
    
    await ctx.editMessageText(
      '📈 *История коэффициентов события*\n\n' +
      'Введите ID события для просмотра истории изменения коэффициентов:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'events_menu')
        ]])
      }
    );
  },

  /**
   * Обработка запроса истории коэффициентов
   */
  async handleOddsHistory(ctx) {
    if (!ctx.session || !ctx.session.oddsHistory) {
      return;
    }
    
    const text = ctx.message.text.trim();
    
    try {
      console.log('ADMIN: Получение истории коэффициентов для события:', text);
      
      const response = await apiClient.get(`/events/admin/${text}/odds-history`);
      
      if (!response.data.success) {
        await ctx.reply('❌ Событие не найдено или ошибка получения данных');
        return;
      }
      
      const data = response.data.data;
      const event = data.event;
      const oddsStats = data.oddsStatistics;
      
      let message = `📈 *История коэффициентов*\n\n`;
      message += `🎯 Событие: ${event.title}\n`;
      message += `📊 Статус: ${event.status}\n`;
      message += `💰 Общий пул: ${event.totalPool.toFixed(2)} USDT\n\n`;
      
      if (oddsStats.hasHistory) {
        message += `🔄 Пересчетов: ${oddsStats.recalculations}\n`;
        message += `📅 Первый расчет: ${new Date(oddsStats.firstCalculation).toLocaleString('ru-RU')}\n`;
        message += `⏰ Последний расчет: ${new Date(oddsStats.lastCalculation).toLocaleString('ru-RU')}\n\n`;
        
        message += '📊 *Текущие коэффициенты:*\n';
        Object.entries(oddsStats.currentOdds).forEach(([outcomeId, odds]) => {
          const outcome = event.outcomes.find(o => o.id === outcomeId);
          message += `• ${outcome.name}: ${odds.toFixed(2)}\n`;
        });
        
        message += '\n📈 *Средние коэффициенты:*\n';
        Object.entries(oddsStats.averageOdds).forEach(([outcomeId, odds]) => {
          const outcome = event.outcomes.find(o => o.id === outcomeId);
          message += `• ${outcome.name}: ${odds.toFixed(2)}\n`;
        });
        
        message += '\n📊 *Экстремальные значения:*\n';
        Object.entries(oddsStats.extremeOdds).forEach(([outcomeId, extremes]) => {
          const outcome = event.outcomes.find(o => o.id === outcomeId);
          message += `• ${outcome.name}: ${extremes.min.toFixed(2)} - ${extremes.max.toFixed(2)}\n`;
        });
        
      } else {
        message += '❌ История коэффициентов отсутствует\n';
        message += 'Возможные причины:\n';
        message += '• Событие только создано\n';
        message += '• Еще не было ни одной ставки\n';
        message += '• Данные не сохранились';
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', `refresh_odds_history_${text}`)],
        [Markup.button.callback('◀️ Назад', 'events_menu')]
      ]);
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      // Очищаем сессию
      delete ctx.session.oddsHistory;
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения истории коэффициентов:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
      delete ctx.session.oddsHistory;
    }
  },

  /**
   * Показать детальную информацию о событии с коэффициентами
   */
  async showEventDetails(ctx, eventId) {
    try {
      console.log('ADMIN: Получение детальной информации о событии:', eventId);
      
      const response = await apiClient.get(`/events/admin/${eventId}`);
      
      if (!response.data.success) {
        return ctx.answerCbQuery('❌ Событие не найдено');
      }
      
      const event = response.data.data.event;
      
      let message = `🎯 *Детали события*\n\n`;
      message += `📝 Название: ${event.title}\n`;
      message += `📋 Описание: ${event.description}\n`;
      message += `📊 Статус: ${event.status}\n`;
      message += `💰 Общий пул: ${event.totalPool.toFixed(2)} USDT\n`;
      message += `🎲 Ставок: ${event.outcomes.reduce((sum, o) => sum + o.betsCount, 0)}\n\n`;
      
      message += '🎯 *Исходы и коэффициенты:*\n';
      event.outcomes.forEach((outcome, index) => {
        const odds = event.currentOdds[outcome.id] || event.initialOdds;
        message += `${index + 1}. ${outcome.name}\n`;
        message += `   💰 Ставок: ${outcome.totalBets.toFixed(2)} USDT (${outcome.betsCount} шт.)\n`;
        message += `   📈 Коэффициент: ${odds.toFixed(2)}\n`;
        message += `   📊 Доля: ${event.totalPool > 0 ? ((outcome.totalBets / event.totalPool) * 100).toFixed(1) : 0}%\n\n`;
      });
      
      // Информация о гибких коэффициентах
      if (event.metadata?.flexibleOddsStats) {
        const stats = event.metadata.flexibleOddsStats;
        message += '🔄 *Статистика гибких коэффициентов:*\n';
        message += `📊 Пересчетов: ${stats.oddsRecalculations || 0}\n`;
        message += `📈 Записей в истории: ${stats.oddsHistory?.length || 0}\n`;
        
        if (stats.extremeOdds && Object.keys(stats.extremeOdds).length > 0) {
          message += '\n📊 *Экстремальные коэффициенты:*\n';
          Object.entries(stats.extremeOdds).forEach(([outcomeId, extremes]) => {
            const outcome = event.outcomes.find(o => o.id === outcomeId);
            message += `• ${outcome.name}: ${extremes.min.toFixed(2)} - ${extremes.max.toFixed(2)}\n`;
          });
        }
      }
      
      // Временная информация
      message += `\n⏰ *Время:*\n`;
      message += `📅 Начало: ${new Date(event.startTime).toLocaleString('ru-RU')}\n`;
      message += `🔒 Ставки до: ${new Date(event.bettingEndsAt).toLocaleString('ru-RU')}\n`;
      message += `🏁 Окончание: ${new Date(event.endTime).toLocaleString('ru-RU')}\n`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📈 История коэффициентов', `show_odds_history_${eventId}`),
          Markup.button.callback('🎯 Управление', `manage_event_${eventId}`)
        ],
        [Markup.button.callback('◀️ Назад', 'events_list')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения детальной информации:', error);
      await ctx.answerCbQuery('❌ Ошибка получения информации о событии');
    }
  },

  /**
   * Показать предупреждение о влиянии на гибкие коэффициенты
   */
  async showFlexibleOddsWarning(ctx, action, eventId) {
    const warnings = {
      'finish': {
        title: '⚠️ Завершение события с гибкими коэффициентами',
        text: 'При завершении события будут рассчитаны ФИНАЛЬНЫЕ коэффициенты и выплаты игрокам.\n\n' +
              '🔄 Выплаты могут отличаться от ожидаемых игроками\n' +
              '📊 Финальные коэффициенты зависят от общего распределения ставок\n' +
              '💰 Некоторые игроки могут получить больше, некоторые меньше\n\n' +
              'Вы уверены, что хотите завершить событие?'
      },
      'early_finish': {
        title: '⚠️ Досрочное завершение с гибкими коэффициентами',
        text: 'Досрочное завершение события повлияет на справедливость гибких коэффициентов.\n\n' +
              '⏰ Игроки могли рассчитывать на дополнительные ставки\n' +
              '📊 Коэффициенты могли измениться при нормальном завершении\n' +
              '💡 Рекомендуется завершать события в назначенное время\n\n' +
              'Продолжить досрочное завершение?'
      },
      'edit_time': {
        title: '⚠️ Изменение времени события с гибкими коэффициентами',
        text: 'Изменение времени может повлиять на динамику коэффициентов.\n\n' +
              '📈 Больше времени = больше ставок = больше изменений коэффициентов\n' +
              '⏰ Меньше времени = меньше возможностей для корректировки\n' +
              '🎯 Игроки могли планировать свои ставки исходя из текущего времени\n\n' +
              'Продолжить изменение времени?'
      }
    };
    
    const warning = warnings[action];
    if (!warning) {
      return false;
    }
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Продолжить', `confirm_${action}_${eventId}`),
        Markup.button.callback('❌ Отмена', 'events_menu')
      ]
    ]);
    
    await ctx.editMessageText(
      `${warning.title}\n\n${warning.text}`,
      {
        parse_mode: 'Markdown',
        ...keyboard
      }
    );
    
    return true;
  },

  /**
   * Показать результат завершения события с анализом гибких коэффициентов
   */
  async showEventFinishResult(ctx, result) {
    let message = '✅ *Событие завершено успешно!*\n\n';
    
    const event = result.event;
    const settlement = result.settlementResults;
    const flexibleOddsImpact = result.flexibleOddsImpact;
    
    // Основная информация
    message += `📝 Событие: ${event.title}\n`;
    message += `🏆 Победитель: ${event.outcomes.find(o => o.id === event.winningOutcome)?.name}\n\n`;
    
    // Результаты расчета
    message += '📊 *Результаты расчета:*\n';
    message += `💰 Выигрышных ставок: ${settlement.winningBets}\n`;
    message += `📉 Проигрышных ставок: ${settlement.losingBets}\n`;
    message += `💵 Общие выплаты: ${settlement.totalPayout.toFixed(2)} USDT\n`;
    message += `🏦 Прибыль казино: ${result.houseProfit.toFixed(2)} USDT\n\n`;
    
    // Анализ влияния гибких коэффициентов
    if (flexibleOddsImpact && flexibleOddsImpact.enabled) {
      message += '🔄 *Влияние гибких коэффициентов:*\n';
      message += `📊 Всего ставок: ${flexibleOddsImpact.totalBets}\n`;
      
      if (flexibleOddsImpact.avgOddsAtBet) {
        message += `📈 Средний коэффициент при ставках: ${flexibleOddsImpact.avgOddsAtBet.toFixed(2)}\n`;
      }
      
      if (flexibleOddsImpact.finalOdds) {
        message += `🎯 Финальный коэффициент: ${flexibleOddsImpact.finalOdds.toFixed(2)}\n`;
      }
      
      message += `✅ Игроков получили больше ожидаемого: ${flexibleOddsImpact.winnersBenefited}\n`;
      message += `❌ Игроков получили меньше ожидаемого: ${flexibleOddsImpact.winnersLost}\n\n`;
      
      if (flexibleOddsImpact.summary) {
        message += `💡 ${flexibleOddsImpact.summary}\n\n`;
      }
      
      // Оценка справедливости
      const totalWinners = flexibleOddsImpact.winnersBenefited + flexibleOddsImpact.winnersLost;
      if (totalWinners > 0) {
        const benefitRate = (flexibleOddsImpact.winnersBenefited / totalWinners * 100).toFixed(1);
        message += `📊 Процент игроков, выигравших от гибких коэффициентов: ${benefitRate}%\n`;
        
        if (benefitRate >= 40 && benefitRate <= 60) {
          message += '✅ Отличный баланс гибких коэффициентов!\n';
        } else if (benefitRate >= 30 && benefitRate <= 70) {
          message += '👍 Хороший баланс гибких коэффициентов\n';
        } else {
          message += '⚠️ Неравномерное влияние гибких коэффициентов\n';
        }
      }
    }
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 К списку событий', 'events_list')],
      [Markup.button.callback('📊 Статистика коэффициентов', 'events_odds_stats')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  },

  /**
   * Экспорт статистики гибких коэффициентов
   */
  async exportFlexibleOddsStats(ctx) {
    try {
      console.log('ADMIN: Экспорт статистики гибких коэффициентов');
      
      const response = await apiClient.get('/events/admin/flexible-odds-export');
      
      if (!response.data.success) {
        return ctx.answerCbQuery('❌ Ошибка экспорта данных');
      }
      
      const stats = response.data.data;
      
      // Формируем отчет
      let report = '📊 ОТЧЕТ ПО ГИБКИМ КОЭФФИЦИЕНТАМ\n';
      report += `Дата: ${new Date().toLocaleString('ru-RU')}\n\n`;
      
      report += '📈 ОБЩАЯ СТАТИСТИКА:\n';
      report += `• Всего событий: ${stats.totalEvents}\n`;
      report += `• События с гибкими коэффициентами: ${stats.eventsWithFlexibleOdds}\n`;
      report += `• Общее количество пересчетов: ${stats.totalRecalculations}\n`;
      report += `• Среднее пересчетов на событие: ${stats.avgRecalculationsPerEvent}\n\n`;
      
      if (stats.benefitAnalysis) {
        report += '💰 АНАЛИЗ ВЫГОДЫ ИГРОКОВ:\n';
        report += `• Игроков получили больше: ${stats.benefitAnalysis.totalBenefited}\n`;
        report += `• Игроков получили меньше: ${stats.benefitAnalysis.totalLost}\n`;
        report += `• Средняя разница в выплатах: ${stats.benefitAnalysis.avgDifference.toFixed(2)} USDT\n\n`;
      }
      
      if (stats.topEvents && stats.topEvents.length > 0) {
        report += '🏆 ТОП СОБЫТИЯ ПО ВОЛАТИЛЬНОСТИ:\n';
        stats.topEvents.forEach((event, index) => {
          report += `${index + 1}. ${event.title} - ${event.recalculations} пересчетов\n`;
        });
      }
      
      // Отправляем как файл
      await ctx.replyWithDocument({
        source: Buffer.from(report, 'utf8'),
        filename: `flexible_odds_report_${new Date().toISOString().split('T')[0]}.txt`
      }, {
        caption: '📊 Отчет по статистике гибких коэффициентов',
        reply_markup: Markup.inlineKeyboard([[
          Markup.button.callback('◀️ Назад', 'events_menu')
        ]])
      });
      
    } catch (error) {
      console.error('ADMIN: Ошибка экспорта статистики:', error);
      await ctx.answerCbQuery('❌ Ошибка экспорта данных');
    }
  }
};

module.exports = eventsExtendedCommands;
