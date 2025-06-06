// bot/src/handlers/duel/inline-duel.handler.js

const { Markup } = require('telegraf');
const { validateDuelParams, generateShortId, getGameConfig, formatDuelMessage, convertGameNameToEmoji } = require('./duel-utils');
const duelGameHandler = require('./duel-game.handler');
const apiService = require('../../services/api.service');

/**
 * Обработчик inline дуэлей для личных сообщений
 */
class InlineDuelHandler {
  
  constructor() {
    // Временное хранение данных inline дуэлей
    this.inlineData = new Map();
    
    // Автоочистка старых данных каждые 30 минут
    setInterval(() => {
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      for (const [key, data] of this.inlineData) {
        if (data.timestamp < thirtyMinutesAgo) {
          this.inlineData.delete(key);
        }
      }
    }, 30 * 60 * 1000);
  }
  
  /**
   * Обработка inline запросов для дуэлей
   */
  handleInlineQuery(bot) {
    bot.on('inline_query', async (ctx) => {
      try {
        const query = ctx.inlineQuery.query.trim();
        const userId = ctx.from.id;
        const username = ctx.from.username;
        
        console.log(`📥 Inline query получен: {
  query: '${query}',
  user: '${username}',
  userId: '${userId}',
  rawQuery: '${query}',
  queryId: '${ctx.inlineQuery.id}'
}`);
        
        const results = [];
        
        // Проверяем на duel команду (очень гибкий regex)
        // Поддерживаем разные форматы:
        // duel @username - минимальный формат (defaults)
        // duel @username amount - с суммой  
        // duel @username amount game - с игрой
        // duel @username amount game format - полный формат
        
        let duelMatch = null;
        
        // Основной regex - ищем минимум username (смягчен до 1+ символов)
        const basicMatch = query.match(/^duel\s+@?(\w+)(?:\s+(\d+))?(?:\s+(🎲|🎯|⚽|🏀|🎳|🎰|dice|darts|football|basketball|bowling|slots?))?(?:\s*(bo[1357]))?$/i);
        
        if (basicMatch) {
          duelMatch = basicMatch;
        } else {
          // Пробуем поймать слитный формат типа "basketballbo3" 
          const combinedMatch = query.match(/^duel\s+@?(\w+)\s+(\d+)\s*(\w+)$/i);
          if (combinedMatch) {
            const combined = combinedMatch[3];
            
            // Разделяем игру и формат (basketballbo3 -> basketball + bo3)
            const gameFormatMatch = combined.match(/^(basketball|football|bowling|slots?|dice|darts)(bo[1357])?$/i);
            if (gameFormatMatch) {
              duelMatch = [combinedMatch[0], combinedMatch[1], combinedMatch[2], gameFormatMatch[1], gameFormatMatch[2] || 'bo1'];
            } else {
              // Может это просто длинная игра без формата
              const gameOnlyMatch = combined.match(/^(basketball|football|bowling|slots?|dice|darts)$/i);
              if (gameOnlyMatch) {
                duelMatch = [combinedMatch[0], combinedMatch[1], combinedMatch[2], gameOnlyMatch[1], 'bo1'];
              } else {
                // Может это неполный формат типа "bo" без цифры
                const incompleteFormatMatch = combined.match(/^bo$/i);
                if (incompleteFormatMatch) {
                  duelMatch = [combinedMatch[0], combinedMatch[1], combinedMatch[2], '🎲', 'bo1']; // Default игра и bo1
                }
              }
            }
          }
        }
        
        if (duelMatch) {
          console.log(`🔍 Проверка duel match: {
  query: '${query}',
  matched: true,
  matchGroups: ${JSON.stringify(duelMatch, null, 2)}
}`);
          
          const targetUsername = duelMatch[1];
          const amount = duelMatch[2] ? parseInt(duelMatch[2]) : 10; // Default 10 USDT
          const rawGameType = duelMatch[3] || '🎲'; // Default кости  
          const gameType = convertGameNameToEmoji(rawGameType); // Конвертируем текст в эмодзи
          const format = duelMatch[4] || 'bo1'; // Default bo1
          
          console.log(`🔄 Парсинг: rawGameType='${rawGameType}' -> gameType='${gameType}'`);
          
          // Валидация параметров
          const validation = validateDuelParams(targetUsername, amount, gameType, format);
          
          if (validation.isValid) {
            const gameConfig = getGameConfig(gameType);
            const shortId = generateShortId(userId, targetUsername);
            
            // Сохраняем данные для последующего использования
            this.inlineData.set(shortId, {
              challengerId: userId,
              challengerUsername: username,
              targetUsername: validation.params.targetUsername,
              amount: validation.params.amount,
              gameType: validation.params.gameType,
              format: validation.params.format,
              timestamp: Date.now()
            });
            
            console.log(`🎮 Парсинг дуэли: {
  targetUsername: '${validation.params.targetUsername}',
  amount: ${validation.params.amount},
  gameType: '${validation.params.gameType}',
  format: '${validation.params.format}',
  challengerUsername: '${username}',
  challengerId: ${userId},
  shortId: '${shortId}'
}`);
            
            results.push({
              type: 'article',
              id: `duel_${Date.now()}_${shortId.split('_')[1]}`,
              title: `${gameConfig.emoji} Дуэль с @${targetUsername}`,
              description: `${validation.params.amount} USDT • ${gameConfig.name} • ${format.toUpperCase()}`,
              input_message_content: {
                message_text: `🎮 **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** 🎮\n\n` +
                             `👤 От: @${username}\n` +
                             `🎯 Вызывает: @${targetUsername}\n` +
                             `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
                             `💰 Ставка: ${validation.params.amount} USDT каждый\n` +
                             `🏆 Формат: ${format.toUpperCase()}\n\n` +
                             `⏱ Время на ответ: 5 минут`,
                parse_mode: 'Markdown'
              },
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '✅ Принять вызов',
                      callback_data: `inline_accept_${shortId}`
                    },
                    {
                      text: '❌ Отклонить',
                      callback_data: `inline_decline_${shortId}`
                    }
                  ],
                  [
                    {
                      text: '📋 Правила игры',
                      callback_data: `inline_rules_${validation.params.gameType}`
                    }
                  ]
                ]
              }
            });
            
            console.log(`💾 Сохранены данные для shortId: ${shortId}`);
          }
        } else {
          console.log(`❌ Duel regex не совпал для query: '${query}'`);
        }
        
        // Всегда добавляем тестовый результат для отладки
        results.push({
          type: 'article',
          id: 'always_test',
          title: '🧪 Тест inline mode',
          description: 'Для тестирования inline режима',
          input_message_content: {
            message_text: '🧪 Тестовое сообщение inline режима\n\nФормат: `duel @username сумма игра формат`\nПример: `duel @player 100 🎲 bo3`',
            parse_mode: 'Markdown'
          }
        });
        
        console.log(`📤 Отправляем inline результаты: {
  resultsCount: ${results.length},
  results: [
    ${results.map(r => `{
      id: '${r.id}',
      title: '${r.title}',
      hasButtons: ${!!r.reply_markup},
      buttonCount: ${r.reply_markup?.inline_keyboard?.flat()?.length || 0}
    }`).join(',\n    ')}
  ]
}`);
        
        await ctx.answerInlineQuery(results, {
          cache_time: 0,
          is_personal: true
        });
        
      } catch (error) {
        console.error('Ошибка обработки inline query:', error);
        await ctx.answerInlineQuery([]);
      }
    });
  }
  
  /**
   * Обработка кнопок inline дуэлей
   */
  handleInlineCallbacks(bot) {
    // Логирование всех callback queries для отладки
    bot.on('callback_query', async (ctx, next) => {
      console.log(`🔘 Любой callback получен: ${ctx.callbackQuery.data}`);
      console.log(`👤 От пользователя: ${ctx.from.username} (${ctx.from.id})`);
      
      if (ctx.callbackQuery.data && ctx.callbackQuery.data.startsWith('inline_')) {
        console.log(`✅ Это inline callback: ${ctx.callbackQuery.data}`);
      } else {
        console.log(`ℹ️ Не inline callback: ${ctx.callbackQuery.data}`);
      }
      await next();
    });
    // Принятие inline дуэли
    bot.action(/^inline_accept_(.+)$/, async (ctx) => {
      try {
        const shortId = ctx.match[1];
        const acceptorId = ctx.from.id.toString();
        const acceptorUsername = ctx.from.username;
        
        console.log(`🎯 Принятие inline дуэли по shortId: ${shortId}`);
        console.log(`📋 Callback data: ${ctx.callbackQuery.data}`);
        
        const duelData = this.inlineData.get(shortId);
        
        if (!duelData) {
          await ctx.answerCbQuery('❌ Приглашение истекло или недействительно');
          return;
        }
        
        // Проверяем что принимающий - это целевой игрок
        if (duelData.targetUsername !== acceptorUsername) {
          await ctx.answerCbQuery('❌ Это приглашение не для вас');
          return;
        }
        
        console.log(`📋 Данные дуэли: {
  challengerId: ${duelData.challengerId},
  challengerUsername: '${duelData.challengerUsername}',
  targetUsername: '${duelData.targetUsername}',
  amount: ${duelData.amount},
  gameType: '${duelData.gameType}',
  format: '${duelData.format}',
  acceptorId: '${acceptorId}',
  acceptorUsername: '${acceptorUsername}'
}`);
        
        // Создаем дуэль через API
        const createDuelData = {
          challengerId: duelData.challengerId,
          challengerUsername: duelData.challengerUsername,
          opponentId: acceptorId,
          opponentUsername: acceptorUsername,
          gameType: duelData.gameType,
          format: duelData.format,
          amount: duelData.amount,
          chatId: 'inline_private',
          chatType: 'private'
        };
        
        console.log(`🔄 Создание дуэли через API:`, createDuelData);
        
        const result = await apiService.createDuel(createDuelData);
        
        if (result.success) {
          const createdDuel = result.data.duel;
          const sessionId = result.data.sessionId;
          
          await ctx.answerCbQuery('✅ Дуэль принята! Начинаем игру...');
          
          // Редактируем сообщение о принятии дуэли
          try {
            const gameConfig = getGameConfig(createdDuel.gameType);
            await ctx.editMessageText(
              `✅ **ДУЭЛЬ ПРИНЯТА!**\n\n` +
              `⚔️ @${createdDuel.challengerUsername} VS @${createdDuel.opponentUsername}\n\n` +
              `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
              `💰 Ставка: ${createdDuel.amount} USDT каждый\n` +
              `🏆 Формат: ${createdDuel.format.toUpperCase()}\n\n` +
              `📱 Игра начинается в личных сообщениях бота!\n\n` +
              `🎮 Перейти в бот: @Greenlightgames_bot`,
              { parse_mode: 'Markdown' }
            );
          } catch (editError) {
            console.error('Ошибка редактирования сообщения:', editError);
          }
          
          // Отправляем игровые сообщения обоим игрокам
          await this.sendGameMessages(ctx, createdDuel, sessionId);
          
          // Удаляем данные из временного хранилища
          this.inlineData.delete(shortId);
          
        } else {
          await ctx.answerCbQuery(`❌ ${result.error || 'Ошибка создания дуэли'}`);
        }
        
      } catch (error) {
        console.error('Ошибка принятия inline дуэли:', error);
        await ctx.answerCbQuery('❌ Ошибка принятия дуэли');
      }
    });
    
    // Отклонение inline дуэли
    bot.action(/^inline_decline_(.+)$/, async (ctx) => {
      try {
        const shortId = ctx.match[1];
        console.log(`❌ Отклонение inline дуэли по shortId: ${shortId}`);
        console.log(`📋 Callback data: ${ctx.callbackQuery.data}`);
        
        const duelData = this.inlineData.get(shortId);
        
        if (duelData) {
          await ctx.answerCbQuery('❌ Вы отклонили приглашение');
          
          // Редактируем сообщение об отклонении
          try {
            const gameConfig = getGameConfig(duelData.gameType);
            await ctx.editMessageText(
              `❌ **ДУЭЛЬ ОТКЛОНЕНА**\n\n` +
              `@${duelData.targetUsername} отклонил вызов от @${duelData.challengerUsername}\n\n` +
              `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
              `💰 Ставка: ${duelData.amount} USDT`,
              { parse_mode: 'Markdown' }
            );
          } catch (editError) {
            console.error('Ошибка редактирования сообщения:', editError);
          }
          
          // Уведомляем инициатора об отклонении
          try {
            await ctx.telegram.sendMessage(
              duelData.challengerId,
              `😢 **Приглашение отклонено**\n\n` +
              `@${duelData.targetUsername} отклонил ваше приглашение на дуэль\n` +
              `${getGameConfig(duelData.gameType).emoji} ${getGameConfig(duelData.gameType).name} • ${duelData.amount} USDT`,
              { parse_mode: 'Markdown' }
            );
          } catch (notifyError) {
            console.error('Ошибка уведомления об отклонении:', notifyError);
          }
          
          this.inlineData.delete(shortId);
        } else {
          await ctx.answerCbQuery('❌ Приглашение уже недействительно');
        }
      } catch (error) {
        console.error('Ошибка отклонения inline дуэли:', error);
        await ctx.answerCbQuery('❌ Ошибка отклонения');
      }
    });
    
    // Правила игры
    bot.action(/^inline_rules_(.+)$/, async (ctx) => {
      try {
        const gameType = ctx.match[1];
        console.log(`📋 Показ правил для игры: ${gameType}`);
        console.log(`📋 Callback data: ${ctx.callbackQuery.data}`);
        
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
   * Отправка игровых сообщений обоим игрокам
   */
  async sendGameMessages(ctx, duel, sessionId) {
    try {
      const gameConfig = getGameConfig(duel.gameType);
      const formatConfig = getFormatConfig(duel.format);
      
      // Определяем кто должен ходить первым (challenger всегда первый)
      const currentPlayerUsername = duel.challengerUsername;
      
      const messageText = `${gameConfig.emoji} **ДУЭЛЬ НАЧИНАЕТСЯ** ${gameConfig.emoji}\n\n` +
                         `⚔️ @${duel.challengerUsername} VS @${duel.opponentUsername}\n\n` +
                         `🎮 Игра: ${gameConfig.name}\n` +
                         `🏆 Формат: ${formatConfig.name} (${formatConfig.description})\n` +
                         `💰 Банк: ${duel.totalAmount} USDT\n` +
                         `📊 Счёт: ${duel.challengerScore}:${duel.opponentScore}\n\n` +
                         `🎯 **Ход: @${currentPlayerUsername}**\n\n` +
                         `🤖 @Greenlightgames_bot`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`${gameConfig.emoji} ${gameConfig.actionText}`, `play_game_${sessionId}`)],
        [Markup.button.callback('📊 Статус дуэли', `duel_status_${sessionId}`)]
      ]);
      
      // Отправляем сообщение принявшему игроку
      await ctx.telegram.sendMessage(
        duel.opponentId,
        messageText,
        { 
          parse_mode: 'Markdown',
          ...keyboard
        }
      );
      
      console.log(`✅ Игровое сообщение отправлено принявшему игроку ${duel.opponentId}`);
      
      // Отправляем сообщение инициатору
      await ctx.telegram.sendMessage(
        duel.challengerId,
        messageText,
        { 
          parse_mode: 'Markdown',
          ...keyboard
        }
      );
      
      console.log(`✅ Игровое сообщение отправлено инициатору ${duel.challengerId}`);
      
    } catch (error) {
      console.error('Ошибка отправки игровых сообщений:', error);
    }
  }
  
  /**
   * Обработка игровых действий для inline дуэлей
   */
  handleGameActions(bot) {
    // Выполнение хода
    bot.action(/^play_game_(.+)$/, async (ctx) => {
      try {
        const sessionId = ctx.match[1];
        const userId = ctx.from.id.toString();
        const username = ctx.from.username;
        
        // Получаем данные дуэли для проверки участия
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        
        if (!duelData.success) {
          await ctx.answerCbQuery('❌ Ошибка получения данных дуэли');
          return;
        }
        
        const duel = duelData.data;
        
        // Проверяем статус дуэли - завершенные дуэли нельзя продолжать
        if (duel.status === 'completed') {
          await ctx.answerCbQuery('🏆 Дуэль уже завершена!');
          return;
        }
        
        // Проверяем является ли пользователь участником дуэли
        if (duel.challengerId !== userId && duel.opponentId !== userId) {
          await ctx.answerCbQuery('❌ Вы не участвуете в этой дуэли!');
          return;
        }
        
        // Выполняем ход через общий игровой обработчик
        const moveResult = await duelGameHandler.makeMove(ctx, sessionId, userId, username);
        
        if (!moveResult) return;
        
        const { duel: updatedDuel, gameResult, gameConfig } = moveResult;
        
        // Форматируем результат
        const resultData = duelGameHandler.formatGameResult(
          updatedDuel, gameResult, gameConfig, userId, username
        );
        
        // Отправляем результат текущему игроку
        await ctx.reply(
          resultData.message,
          { parse_mode: 'Markdown' }
        );
        
        // Уведомляем противника
        if (resultData.opponentId) {
          await duelGameHandler.notifyOpponent(
            ctx, 
            resultData.opponentId, 
            updatedDuel, 
            gameConfig, 
            resultData.isCompleted,
            resultData.roundsText
          );
        }
        
      } catch (error) {
        console.error('Ошибка игрового действия:', error);
        await ctx.answerCbQuery('❌ Ошибка выполнения хода');
      }
    });
    
    // Проверка статуса дуэли
    bot.action(/^duel_status_(.+)$/, async (ctx) => {
      try {
        const sessionId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        
        if (duelData.success) {
          const duel = duelData.data;
          
          // Проверяем является ли пользователь участником дуэли
          if (duel.challengerId !== userId && duel.opponentId !== userId) {
            await ctx.answerCbQuery('❌ Вы не участвуете в этой дуэли!');
            return;
          }
          
          const gameConfig = getGameConfig(duel.gameType);
          
          const statusMessage = formatDuelMessage(duel, true) + 
                               `\n\n📊 **Текущий счёт:** ${duel.challengerScore}:${duel.opponentScore}\n` +
                               `🎯 **Статус:** ${this.getStatusText(duel.status)}`;
          
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

module.exports = new InlineDuelHandler();