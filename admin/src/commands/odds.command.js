// admin/src/commands/odds.command.js
const { Markup } = require('telegraf');
const adminService = require('../services/admin.service');

/**
 * Команда для управления шансами в играх
 */
const oddsCommand = {
  // Главное меню управления шансами
  async showOddsMenu(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Статистика модификаторов', 'odds_stats')],
      [Markup.button.callback('👤 Модификаторы пользователя', 'odds_user')],
      [Markup.button.callback('🎮 Установить модификатор', 'odds_set')],
      [Markup.button.callback('👥 Массовая установка', 'odds_bulk')],
      [Markup.button.callback('🔄 Сбросить модификаторы', 'odds_reset')],
      [Markup.button.callback('◀️ Назад', 'admin_menu')]
    ]);

    await ctx.editMessageText(
      '⚙️ *Управление шансами в играх*\n\n' +
      'Выберите действие:',
      {
        parse_mode: 'Markdown',
        ...keyboard
      }
    );
  },

  // Показать статистику модификаторов
  async showOddsStats(ctx) {
    try {
      const stats = await adminService.getOddsStatistics();
      
      let message = '📊 *Статистика модификаторов*\n\n';
      message += `👥 Всего пользователей: ${stats.totalUsers}\n`;
      message += `🔧 С модификаторами: ${stats.modifiedUsers}\n\n`;

      // Статистика по играм
      Object.entries(stats.gameStats).forEach(([game, data]) => {
        if (data.modified > 0) {
          const gameEmoji = {
            coin: '🪙',
            slots: '🎰',
            mines: '💣',
            crash: '📈'
          }[game];

          message += `${gameEmoji} *${game.toUpperCase()}*\n`;
          message += `  Изменено: ${data.modified}\n`;
          message += `  Средний: ${data.avgModifier.toFixed(1)}%\n`;
          message += `  Мин/Макс: ${data.minModifier}% / ${data.maxModifier}%\n\n`;
        }
      });

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад', 'odds_menu')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      await ctx.answerCbQuery('❌ Ошибка получения статистики');
    }
  },

  // Запросить ID пользователя
  async requestUserId(ctx, action) {
    ctx.session.oddsAction = action;
    
    await ctx.editMessageText(
      '👤 *Введите ID или @username пользователя:*',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('◀️ Отмена', 'odds_menu')
        ]])
      }
    );
  },

  // Показать модификаторы пользователя
  async showUserModifiers(ctx, userId) {
    try {
      const data = await adminService.getUserModifiers(userId);
      
      let message = `👤 *Модификаторы пользователя*\n\n`;
      message += `ID: \`${data.userId}\`\n`;
      message += `Username: ${data.username || 'Не указан'}\n\n`;

      const gameSettings = data.gameSettings || {};
      
      message += '🎮 *Настройки игр:*\n';
      message += `🪙 Монетка: ${gameSettings.coin?.winChanceModifier || 0}%\n`;
      message += `🎰 Слоты RTP: ${gameSettings.slots?.rtpModifier || 0}%\n`;
      message += `💣 Мины: ${gameSettings.mines?.mineChanceModifier || 0}%\n`;
      message += `📈 Краш: ${gameSettings.crash?.crashModifier || 0}%\n`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔧 Изменить', `odds_set_user_${userId}`)],
        [Markup.button.callback('🔄 Сбросить', `odds_reset_user_${userId}`)],
        [Markup.button.callback('◀️ Назад', 'odds_menu')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
    }
  },

  // Выбор игры для установки модификатора
  async selectGame(ctx, userId) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🪙 Монетка', `odds_game_coin_${userId}`),
        Markup.button.callback('🎰 Слоты', `odds_game_slots_${userId}`)
      ],
      [
        Markup.button.callback('💣 Мины', `odds_game_mines_${userId}`),
        Markup.button.callback('📈 Краш', `odds_game_crash_${userId}`)
      ],
      [Markup.button.callback('◀️ Назад', userId ? `odds_user_show_${userId}` : 'odds_menu')]
    ]);

    await ctx.editMessageText(
      '🎮 *Выберите игру:*',
      {
        parse_mode: 'Markdown',
        ...keyboard
      }
    );
  },

  // Установка модификатора
  async setModifier(ctx, gameType, userId) {
    ctx.session.oddsGame = gameType;
    ctx.session.oddsUserId = userId;

    const gameNames = {
      coin: 'Монетка (шанс выигрыша)',
      slots: 'Слоты (RTP)',
      mines: 'Мины (количество мин)',
      crash: 'Краш (вероятность раннего краша)'
    };

    const limits = {
      coin: { min: -47.5, max: 52.5 },
      slots: { min: -30, max: 20 },
      mines: { min: -20, max: 30 },
      crash: { min: -20, max: 50 }
    };

    const limit = limits[gameType];

    await ctx.editMessageText(
      `🔧 *Установка модификатора*\n\n` +
      `Игра: ${gameNames[gameType]}\n` +
      `Пределы: от ${limit.min}% до ${limit.max}%\n\n` +
      `Введите значение модификатора в процентах:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('◀️ Отмена', `odds_set_user_${userId}`)
        ]])
      }
    );
  },

  // Применить модификатор
  async applyModifier(ctx, value) {
    const { oddsGame, oddsUserId } = ctx.session;
    
    try {
      const modifierType = {
        coin: 'winChanceModifier',
        slots: 'rtpModifier',
        mines: 'mineChanceModifier',
        crash: 'crashModifier'
      }[oddsGame];

      await adminService.setUserGameModifier(oddsUserId, oddsGame, modifierType, value);
      
      await ctx.reply('✅ Модификатор успешно установлен!');
      
      // Возвращаемся к просмотру модификаторов пользователя
      await this.showUserModifiers(ctx, oddsUserId);
      
      // Очищаем сессию
      delete ctx.session.oddsGame;
      delete ctx.session.oddsUserId;
    } catch (error) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  },

  // Сброс модификаторов пользователя
  async resetUserModifiers(ctx, userId) {
    try {
      await adminService.resetUserModifiers(userId);
      
      await ctx.answerCbQuery('✅ Модификаторы сброшены');
      await this.showUserModifiers(ctx, userId);
    } catch (error) {
      await ctx.answerCbQuery('❌ Ошибка сброса модификаторов');
    }
  }
};

module.exports = oddsCommand;