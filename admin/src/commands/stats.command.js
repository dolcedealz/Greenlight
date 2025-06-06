// admin/src/commands/stats.command.js
const axios = require('axios');
const config = require('../config');

async function statsCommand(ctx) {
  try {
    const message = ctx.message.text.split(' ');
    const command = message[1] || 'finance'; // По умолчанию финансовая статистика
    
    switch (command) {
      case 'finance':
      case 'финансы':
        await showFinanceStats(ctx);
        break;
        
      case 'users':
      case 'пользователи':
        await showUserStats(ctx);
        break;
        
      case 'games':
      case 'игры':
        await showGameStats(ctx);
        break;
        
      case 'commission':
      case 'комиссии':
        await showCommissionStats(ctx);
        break;
        
      default:
        const { Markup } = require('telegraf');
        await ctx.reply(
          '📊 <b>Статистика казино</b>\n\n' +
          'Доступные команды:\n' +
          '• /stats finance - Финансовая статистика\n' +
          '• /stats commission - Детали по комиссиям\n' +
          '• /stats users - Статистика пользователей\n' +
          '• /stats games - Статистика игр',
          { 
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('📊 Финансы', 'finances_stats'),
                Markup.button.callback('👥 Пользователи', 'users_stats')
              ],
              [
                Markup.button.callback('🎮 Игры', 'finances_games'),
                Markup.button.callback('💰 Комиссии', 'stats_commission')
              ],
              [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ])
          }
        );
    }
    
  } catch (error) {
    console.error('Ошибка команды /stats:', error);
    await ctx.reply('❌ Ошибка получения статистики. Попробуйте позже.');
  }
}

async function showFinanceStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/finance/report`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const finance = response.data.data.current;
    
    let message = '📊 <b>ФИНАНСОВАЯ СТАТИСТИКА</b>\n\n';
    
    // Основные балансы
    message += '🏦 <b>Основные балансы:</b>\n';
    message += `💰 Баланс пользователей: <code>${finance.totalUserBalance.toFixed(2)} USDT</code>\n`;
    message += `💰 Оперативный баланс: <code>${finance.operationalBalance.toFixed(2)} USDT</code>\n`;
    message += `💰 Резерв (${finance.reservePercentage}%): <code>${finance.reserveBalance.toFixed(2)} USDT</code>\n`;
    message += `✅ Доступно для вывода: <code>${finance.availableForWithdrawal.toFixed(2)} USDT</code>\n\n`;
    
    // Доходы и расходы
    message += '📈 <b>Доходы и расходы:</b>\n';
    message += `💰 Общие комиссии: <code>${finance.totalCommissions?.toFixed(2) || '0.00'} USDT</code>\n`;
    if (finance.commissionBreakdown) {
      message += `  ⚔️ Дуэли: <code>${finance.commissionBreakdown.duels?.toFixed(2) || '0.00'} USDT</code>\n`;
      message += `  ⚡ События: <code>${finance.commissionBreakdown.events?.toFixed(2) || '0.00'} USDT</code>\n`;
    }
    message += `⬇️ Промокоды: <code>-${finance.totalPromocodeExpenses?.toFixed(2) || '0.00'} USDT</code>\n\n`;
    
    // Предупреждения
    if (finance.warnings) {
      const warningsList = [];
      if (finance.warnings.lowReserve) warningsList.push('⚠️ Низкий резерв');
      if (finance.warnings.highRiskRatio) warningsList.push('🔴 Высокий риск');
      if (finance.warnings.negativeOperational) warningsList.push('⚠️ Отрицательный баланс');
      
      if (warningsList.length > 0) {
        message += '⚠️ <b>Предупреждения:</b>\n';
        warningsList.forEach(warning => {
          message += `• ${warning}\n`;
        });
        message += '\n';
      }
    }
    
    // Формула расчета
    message += '📊 <b>Формула оперативного баланса:</b>\n';
    message += '<i>Ставки - Выигрыши + Комиссии - Промокоды</i>\n\n';
    
    message += '📊 /stats commission - детали по комиссиям';
    
    const { Markup } = require('telegraf');
    await ctx.reply(message, { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 Комиссии', 'stats_commission'),
          Markup.button.callback('🔄 Обновить', 'finances_stats')
        ],
        [Markup.button.callback('🏠 Главное меню', 'main_menu')]
      ])
    });
    
  } catch (error) {
    console.error('Ошибка получения финансовой статистики:', error);
    await ctx.reply('❌ Ошибка получения финансовой статистики');
  }
}

async function showCommissionStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/finance/report`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const { current, allTime } = response.data.data;
    
    let message = '📊 <b>ДЕТАЛИ ПО КОМИССИЯМ</b>\n\n';
    
    // Разбивка комиссий
    message += '📊 <b>Источники комиссий:</b>\n';
    if (current.commissionBreakdown) {
      const duels = current.commissionBreakdown.duels || 0;
      const events = current.commissionBreakdown.events || 0;
      const total = duels + events;
      
      message += `⚔️ PvP Дуэли: <code>${duels.toFixed(2)} USDT</code>`;
      if (total > 0) message += ` (${((duels/total)*100).toFixed(1)}%)`;
      message += '\n';
      
      message += `  ⚡ 5% с каждой дуэли\n`;
      
      message += `⚡ События: <code>${events.toFixed(2)} USDT</code>`;
      if (total > 0) message += ` (${((events/total)*100).toFixed(1)}%)`;
      message += '\n';
      
      message += `  ⚡ Маржа в коэффициентах\n`;
      
      message += `✅ Всего: <code>${total.toFixed(2)} USDT</code>\n\n`;
    }
    
    // Расходы на промокоды
    message += '💸 <b>Расходы на промокоды:</b>\n';
    message += `⬇️ Всего: <code>${current.totalPromocodeExpenses?.toFixed(2) || '0.00'} USDT</code>\n\n`;
    
    // Чистая прибыль
    const netProfit = (current.totalCommissions || 0) - (current.totalPromocodeExpenses || 0);
    message += '💰 <b>Чистая прибыль от комиссий:</b>\n';
    message += `💰 <code>${netProfit.toFixed(2)} USDT</code>\n\n`;
    
    // Статистика игр
    if (allTime.gameStats) {
      message += '💸 <b>Прибыль по играм:</b>\n';
      
      Object.entries(allTime.gameStats).forEach(([game, stats]) => {
        if (stats.profit > 0) {
          const gameNames = {
            coin: '🪙 Монетка',
            mines: '💣 Мины',
            slots: '🎰 Слоты',
            crash: '🚀 Краш',
            events: '⚡ События'
          };
          
          message += `💰 ${gameNames[game] || game}: <code>${stats.profit.toFixed(2)} USDT</code>\n`;
        }
      });
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка получения статистики комиссий:', error);
    await ctx.reply('❌ Ошибка получения статистики комиссий');
  }
}

async function showUserStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/stats/users`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const stats = response.data.data;
    
    let message = '👥 <b>СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ</b>\n\n';
    
    message += `👤 Всего пользователей: <code>${stats.totalUsers || 0}</code>\n`;
    message += `💚 Активных (за 24ч): <code>${stats.activeToday || 0}</code>\n`;
    message += `💚 Активных (за неделю): <code>${stats.activeWeek || 0}</code>\n`;
    message += `💰 С депозитами: <code>${stats.withDeposits || 0}</code>\n`;
    message += `🚫 Заблокированных: <code>${stats.blocked || 0}</code>\n\n`;
    
    if (stats.averageBalance) {
      message += `📊 Средний баланс: <code>${stats.averageBalance.toFixed(2)} USDT</code>\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка получения статистики пользователей:', error);
    await ctx.reply('❌ Ошибка получения статистики пользователей');
  }
}

async function showGameStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/finance/report`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const { allTime } = response.data.data;
    
    let message = '🎮 <b>СТАТИСТИКА ИГР</b>\n\n';
    
    if (allTime.gameStats) {
      Object.entries(allTime.gameStats).forEach(([game, stats]) => {
        const gameNames = {
          coin: '🪙 Монетка',
          mines: '💣 Мины',
          slots: '🎰 Слоты',
          crash: '🚀 Краш',
          events: '⚡ События'
        };
        
        if (stats.totalGames > 0) {
          message += `${gameNames[game] || game}\n`;
          message += `🎯 Игр: <code>${stats.totalGames}</code>\n`;
          message += `💰 Ставок: <code>${stats.totalBets.toFixed(2)} USDT</code>\n`;
          message += `💸 Выплат: <code>${stats.totalWins.toFixed(2)} USDT</code>\n`;
          message += `💰 Прибыль: <code>${stats.profit.toFixed(2)} USDT</code>\n`;
          
          if (stats.totalBets > 0) {
            const rtp = ((stats.totalWins / stats.totalBets) * 100);
            message += `⬇️ RTP: <code>${rtp.toFixed(1)}%</code>\n\n`;
          } else {
            message += '\n';
          }
        }
      });
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка получения статистики игр:', error);
    await ctx.reply('❌ Ошибка получения статистики игр');
  }
}

module.exports = statsCommand;
module.exports.showCommissionStats = showCommissionStats;
module.exports.showFinanceStats = showFinanceStats;
module.exports.showUserStats = showUserStats;
module.exports.showGameStats = showGameStats;