// bot/src/handlers/duel/group-duel.handler.js

const { Markup } = require('telegraf');
const { validateDuelParams, getGameConfig, getFormatConfig, formatDuelMessage, formatRoundResults } = require('./duel-utils');
const duelGameHandler = require('./duel-game.handler');
const apiService = require('../../services/api.service');

/**
 * Обработчик групповых дуэлей
 */
class GroupDuelHandler {
  
  /**
   * Обработка команд дуэлей в группах
   */
  handleDuelCommands(bot) {
    console.log('🔧 Регистрация команды /duel в группах...');
    
    // Универсальное логирование всех команд для отладки
    bot.on('text', async (ctx, next) => {
      if (ctx.message.text && ctx.message.text.startsWith('/duel')) {
        console.log(`🔍 Команда /duel получена: "${ctx.message.text}"`);
        console.log(`👤 От: ${ctx.from.username} (${ctx.from.id})`);
        console.log(`💬 В чате: ${ctx.chat.id} (${ctx.chat.title || 'private'})`);
        console.log(`📋 Тип чата: ${ctx.chat.type}`);
      }
      await next();
    });
    
    // Команда /duel
    bot.command('duel', async (ctx) => {
      console.log('🎯 НОВЫЙ обработчик /duel сработал!');
      try {
        // Проверяем что это групповой чат
        if (ctx.chat.type === 'private') {
          await ctx.reply(
            '🤖 В личных сообщениях используйте inline режим:\n\n' +
            '`@greenlight_bot duel @username сумма игра формат`\n\n' +
            'Пример: `@greenlight_bot duel @player 100 🎲 bo3`',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const args = ctx.message.text.split(' ').slice(1);
        const userId = ctx.from.id.toString();
        const username = ctx.from.username;
        const chatId = ctx.chat.id.toString();
        const messageId = ctx.message.message_id;
        
        console.log(`📝 Команда дуэли в группе: {
  args: [${args.join(', ')}],
  userId: '${userId}',
  username: '${username}',
  chatId: '${chatId}'
}`);
        
        if (args.length === 0) {
          await this.showDuelHelp(ctx);
          return;
        }
        
        // Парсим команду
        const duelParams = this.parseDuelCommand(args);
        
        if (!duelParams.isValid) {
          await ctx.reply(
            `❌ **Ошибка команды:**\n${duelParams.errors.join('\n')}\n\n` +
            this.getDuelHelpText(),
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const { targetUsername, amount, gameType, format, isOpen } = duelParams;
        
        // Создаем дуэль через API
        const createDuelData = {
          challengerId: userId,
          challengerUsername: username,
          opponentUsername: targetUsername,
          gameType,
          format,
          amount,
          chatId,
          chatType: 'group',
          messageId
        };
        
        console.log(`API: Создаем дуэль:`, createDuelData);
        
        const result = await apiService.createDuel(createDuelData);
        
        if (result.success) {
          const duel = result.data.duel;
          const sessionId = result.data.sessionId;
          
          // Отправляем сообщение с приглашением
          await this.sendDuelInvitation(ctx, duel, sessionId, isOpen);
          
        } else {
          await ctx.reply(
            `❌ **Ошибка создания дуэли:**\n${result.error}`,
            { parse_mode: 'Markdown' }
          );
        }
        
      } catch (error) {
        console.error('Ошибка команды дуэли:', error);
        await ctx.reply('❌ Ошибка обработки команды дуэли');
      }
    });
  }
  
  /**
   * Парсинг команды дуэли
   */
  parseDuelCommand(args) {
    const errors = [];
    let targetUsername = null;
    let amount, gameType, format;
    let isOpen = false;
    
    // Проверяем формат команды
    if (args.length < 3) {
      errors.push('Недостаточно параметров');
      return { isValid: false, errors };
    }
    
    // Определяем тип дуэли (открытая или направленная)
    if (args[0].startsWith('@')) {
      // Направленная дуэль: /duel @username amount game format
      if (args.length !== 4) {
        errors.push('Неверный формат. Используйте: /duel @username сумма игра формат');
        return { isValid: false, errors };
      }
      
      targetUsername = args[0].replace('@', '');
      amount = args[1];
      gameType = args[2];
      format = args[3];
      isOpen = false;
    } else {
      // Открытая дуэль: /duel amount game format
      if (args.length !== 3) {
        errors.push('Неверный формат. Используйте: /duel сумма игра формат');
        return { isValid: false, errors };
      }
      
      amount = args[0];
      gameType = args[1];
      format = args[2];
      isOpen = true;
    }
    
    // Валидируем параметры
    const validation = validateDuelParams(targetUsername || 'dummy', amount, gameType, format);
    
    if (!validation.isValid) {
      return { isValid: false, errors: validation.errors };
    }
    
    return {
      isValid: true,
      targetUsername: isOpen ? null : validation.params.targetUsername,
      amount: validation.params.amount,
      gameType: validation.params.gameType,
      format: validation.params.format,
      isOpen
    };
  }
  
  /**
   * Отправка приглашения на дуэль
   */
  async sendDuelInvitation(ctx, duel, sessionId, isOpen) {
    try {
      const gameConfig = getGameConfig(duel.gameType);
      const formatConfig = getFormatConfig(duel.format);
      
      const messageText = `${gameConfig.emoji} **ВЫЗОВ НА ДУЭЛЬ** ${gameConfig.emoji}\n\n` +
                         `👤 Вызывает: @${duel.challengerUsername}\n` +
                         `${isOpen ? '🌍 Открытый вызов' : `🎯 Против: @${duel.opponentUsername}`}\n\n` +
                         `🎮 Игра: ${gameConfig.name}\n` +
                         `💰 Ставка: ${duel.amount} USDT каждый\n` +
                         `🏆 Формат: ${formatConfig.name} (${formatConfig.description})\n` +
                         `💎 Общий банк: ${duel.totalAmount} USDT\n` +
                         `🎯 Выигрыш: ${duel.winAmount} USDT\n\n` +
                         `⏱ Время на ответ: 5 минут`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять вызов', `accept_group_duel_${sessionId}`)],
        [
          Markup.button.callback('📋 Правила игры', `group_rules_${duel.gameType}`),
          Markup.button.callback('❌ Отменить', `cancel_duel_${sessionId}`)
        ]
      ]);
      
      console.log(`📤 Отправляем приглашение на дуэль в группу...`);
      
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      console.log(`✅ Приглашение отправлено: {
  messageId: ${sentMessage.message_id},
  sessionId: '${sessionId}',
  isOpen: ${isOpen}
}`);
      
    } catch (error) {
      console.error('Ошибка отправки приглашения:', error);
    }
  }
  
  /**
   * Обработка кнопок групповых дуэлей
   */
  handleGroupCallbacks(bot) {
    // Принятие группового вызова
    bot.action(/^accept_group_duel_(.+)$/, async (ctx) => {
      try {
        const sessionId = ctx.match[1];
        const userId = ctx.from.id.toString();
        const username = ctx.from.username;
        
        console.log(`🎯 Принятие группового вызова: {
  sessionId: '${sessionId}',
  userId: '${userId}',
  username: '${username}'
}`);
        
        const result = await apiService.acceptDuel(sessionId, userId, ctx.from);
        
        if (result.success) {
          const duel = result.data.duel;
          
          await ctx.answerCbQuery('✅ Дуэль принята! Начинаем игру...');
          
          // Обновляем сообщение на игровое
          await this.updateToGameMessage(ctx, duel, sessionId);
          
        } else {
          await ctx.answerCbQuery(`❌ ${result.error}`);
        }
        
      } catch (error) {
        console.error('Ошибка принятия группового вызова:', error);
        await ctx.answerCbQuery('❌ Ошибка принятия вызова');
      }
    });
    
    // Отмена дуэли
    bot.action(/^cancel_duel_(.+)$/, async (ctx) => {
      try {
        const sessionId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        // TODO: Реализовать отмену дуэли в API
        
        await ctx.answerCbQuery('❌ Дуэль отменена');
        
        await ctx.editMessageText(
          '❌ **Дуэль отменена**\n\nИнициатор отменил вызов',
          { parse_mode: 'Markdown' }
        );
        
      } catch (error) {
        console.error('Ошибка отмены дуэли:', error);
        await ctx.answerCbQuery('❌ Ошибка отмены');
      }
    });
    
    // Правила игры
    bot.action(/^group_rules_(.+)$/, async (ctx) => {
      try {
        const gameType = ctx.match[1];
        const gameConfig = getGameConfig(gameType);
        
        await ctx.answerCbQuery(
          `${gameConfig.emoji} ${gameConfig.name}: ${gameConfig.rules}`,
          { show_alert: true }
        );
      } catch (error) {
        console.error('Ошибка показа правил:', error);
        await ctx.answerCbQuery('❌ Ошибка получения правил');
      }
    });
  }
  
  /**
   * Обновление сообщения на игровое (после принятия вызова)
   */
  async updateToGameMessage(ctx, duel, sessionId) {
    try {
      const gameConfig = getGameConfig(duel.gameType);
      const formatConfig = getFormatConfig(duel.format);
      
      // Определяем кто должен ходить первым
      const currentPlayer = duelGameHandler.getCurrentPlayer(duel);
      
      const messageText = `${gameConfig.emoji} **ДУЭЛЬ НАЧИНАЕТСЯ** ${gameConfig.emoji}\n\n` +
                         `⚔️ @${duel.challengerUsername} VS @${duel.opponentUsername}\n\n` +
                         `🎮 Игра: ${gameConfig.name}\n` +
                         `🏆 Формат: ${formatConfig.name} (${formatConfig.description})\n` +
                         `💰 Банк: ${duel.totalAmount} USDT\n` +
                         `📊 Счёт: ${duel.challengerScore}:${duel.opponentScore}\n\n` +
                         `🎯 **Ход: @${currentPlayer.currentPlayerUsername}**\n\n` +
                         `🤖 @Greenlightgames_bot`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`${gameConfig.emoji} Ход @${currentPlayer.currentPlayerUsername}`, `group_move_${sessionId}`)],
        [Markup.button.callback('📊 Статус дуэли', `group_status_${sessionId}`)]
      ]);
      
      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      console.log(`✅ Сообщение обновлено на игровое для дуэли ${sessionId}`);
      
    } catch (error) {
      console.error('Ошибка обновления на игровое сообщение:', error);
    }
  }
  
  /**
   * Обработка игровых действий в группах
   */
  handleGroupGameActions(bot) {
    // Выполнение хода в группе
    bot.action(/^group_move_(.+)$/, async (ctx) => {
      try {
        const sessionId = ctx.match[1];
        const userId = ctx.from.id.toString();
        const username = ctx.from.username;
        
        // Получаем данные дуэли для проверки очередности
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        
        if (!duelData.success) {
          await ctx.answerCbQuery('❌ Ошибка получения данных дуэли');
          return;
        }
        
        const duel = duelData.data;
        
        // DEBUG: Логируем полученные данные дуэли в группе
        console.log('🔍 DEBUG GROUP: Полученные данные дуэли в группе:', {
          sessionId: duel.sessionId,
          gameType: duel.gameType,
          format: duel.format,
          status: duel.status,
          challengerId: duel.challengerId,
          opponentId: duel.opponentId,
          duelKeys: Object.keys(duel)
        });
        
        // Проверяем статус дуэли - завершенные дуэли нельзя продолжать
        if (duel.status === 'completed') {
          await ctx.answerCbQuery('🏆 Дуэль уже завершена!');
          return;
        }
        
        // Дополнительная проверка - является ли пользователь участником дуэли
        if (duel.challengerId !== userId && duel.opponentId !== userId) {
          await ctx.answerCbQuery('❌ Вы не участвуете в этой дуэли!');
          return;
        }
        
        // Проверяем может ли игрок сделать ход
        if (!duelGameHandler.canPlayerMove(duel, userId)) {
          await ctx.answerCbQuery('❌ Сейчас не ваш ход!');
          return;
        }
        
        // Выполняем ход
        const moveResult = await duelGameHandler.makeMove(ctx, sessionId, userId, username);
        
        if (!moveResult) return;
        
        const { duel: updatedDuel, gameResult, gameConfig } = moveResult;
        
        // Обновляем сообщение в группе
        await this.updateGroupGameMessage(ctx, updatedDuel, sessionId, gameResult, username);
        
      } catch (error) {
        console.error('Ошибка группового хода:', error);
        await ctx.answerCbQuery('❌ Ошибка выполнения хода');
      }
    });
    
    // Статус дуэли в группе
    bot.action(/^group_status_(.+)$/, async (ctx) => {
      try {
        const sessionId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        
        if (duelData.success) {
          const duel = duelData.data;
          const gameConfig = getGameConfig(duel.gameType);
          const roundsText = formatRoundResults(duel.rounds, duel.challengerUsername, duel.opponentUsername, duel);
          
          const statusMessage = `📊 **Статус дуэли ${duel.sessionId}**\n\n` +
                               formatDuelMessage(duel) + '\n\n' +
                               `📊 **Текущий счёт:** ${duel.challengerScore}:${duel.opponentScore}\n` +
                               `🎯 **Статус:** ${this.getStatusText(duel.status)}\n\n` +
                               roundsText;
          
          await ctx.answerCbQuery();
          await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
        } else {
          await ctx.answerCbQuery('❌ Ошибка получения статуса');
        }
        
      } catch (error) {
        console.error('Ошибка получения статуса:', error);
        await ctx.answerCbQuery('❌ Ошибка получения статуса');
      }
    });
  }
  
  /**
   * Обновление игрового сообщения в группе
   */
  async updateGroupGameMessage(ctx, duel, sessionId, lastResult, lastPlayerUsername) {
    try {
      const gameConfig = getGameConfig(duel.gameType);
      const formatConfig = getFormatConfig(duel.format);
      
      if (duel.status === 'completed') {
        // Дуэль завершена
        const winnerUsername = duel.winnerId === duel.challengerId ? duel.challengerUsername : duel.opponentUsername;
        const roundsText = formatRoundResults(duel.rounds, duel.challengerUsername, duel.opponentUsername, duel);
        
        const messageText = `🏆 **ДУЭЛЬ ЗАВЕРШЕНА** 🏆\n\n` +
                           `⚔️ @${duel.challengerUsername} VS @${duel.opponentUsername}\n\n` +
                           `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
                           `📊 Финальный счёт: ${duel.challengerScore}:${duel.opponentScore}\n` +
                           `👑 Победитель: @${winnerUsername}\n` +
                           `💰 Выигрыш: ${duel.winAmount} USDT\n\n` +
                           `🎯 Последний ход: @${lastPlayerUsername} [${lastResult}]\n\n` +
                           roundsText + '\n' +
                           `📋 ID дуэли: \`${duel.sessionId}\``;
        
        await ctx.editMessageText(messageText, { parse_mode: 'Markdown' });
        
      } else {
        // Дуэль продолжается
        const currentPlayer = duelGameHandler.getCurrentPlayer(duel);
        const roundsText = formatRoundResults(duel.rounds, duel.challengerUsername, duel.opponentUsername, duel);
        
        const messageText = `${gameConfig.emoji} **ДУЭЛЬ В ПРОЦЕССЕ** ${gameConfig.emoji}\n\n` +
                           `⚔️ @${duel.challengerUsername} VS @${duel.opponentUsername}\n\n` +
                           `🎮 Игра: ${gameConfig.name}\n` +
                           `🏆 Формат: ${formatConfig.name} (${formatConfig.description})\n` +
                           `📊 Счёт: ${duel.challengerScore}:${duel.opponentScore}\n` +
                           `🎯 Последний ход: @${lastPlayerUsername} [${lastResult}]\n\n` +
                           (roundsText ? roundsText + '\n' : '') +
                           `🎯 **Ход: @${currentPlayer.currentPlayerUsername}**\n\n` +
                           `🤖 @Greenlightgames_bot`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(`${gameConfig.emoji} Ход @${currentPlayer.currentPlayerUsername}`, `group_move_${sessionId}`)],
          [Markup.button.callback('📊 Статус дуэли', `group_status_${sessionId}`)]
        ]);
        
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
      
    } catch (error) {
      console.error('Ошибка обновления игрового сообщения:', error);
    }
  }
  
  /**
   * Показ справки по дуэлям
   */
  async showDuelHelp(ctx) {
    const helpText = this.getDuelHelpText();
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }
  
  /**
   * Получение текста справки
   */
  getDuelHelpText() {
    return `🎮 **СПРАВКА ПО ДУЭЛЯМ**\n\n` +
           `**Открытые дуэли:**\n` +
           `\`/duel сумма игра формат\`\n` +
           `Пример: \`/duel 50 🎲 bo3\`\n\n` +
           `**Направленные дуэли:**\n` +
           `\`/duel @username сумма игра формат\`\n` +
           `Пример: \`/duel @player 100 🎯 bo1\`\n\n` +
           `**Доступные игры:**\n` +
           `🎲 Кости • 🎯 Дартс • ⚽ Футбол\n` +
           `🏀 Баскетбол • 🎳 Боулинг • 🎰 Слоты\n\n` +
           `**Форматы:**\n` +
           `bo1 - до 1 победы\n` +
           `bo3 - до 2 побед\n` +
           `bo5 - до 3 побед\n` +
           `bo7 - до 4 побед\n\n` +
           `**Ставки:** от 1 до 1000 USDT`;
  }
  
  /**
   * Получение текста статуса
   */
  getStatusText(status) {
    const statuses = {
      'pending': '⏳ Ожидание принятия',
      'accepted': '✅ Принята',
      'active': '🎮 Идет игра',
      'completed': '🏆 Завершена',
      'cancelled': '❌ Отменена'
    };
    
    return statuses[status] || status;
  }
}

module.exports = new GroupDuelHandler();