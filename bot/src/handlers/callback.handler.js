// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

// Функция получения названия игры
function getGameName(gameType) {
  const gameNames = {
    '🎲': 'Кости',
    '🎯': 'Дартс', 
    '⚽': 'Футбол',
    '🏀': 'Баскетбол',
    '🎰': 'Слоты',
    '🎳': 'Боулинг'
  };
  return gameNames[gameType] || 'Неизвестная игра';
}

// Функция получения конфигурации игры
function getGameConfig(gameType) {
  const gameConfigs = {
    '🎲': {
      emoji: '🎲',
      actionText: 'Бросить кость',
      processText: 'Бросаем кость...',
      resultText: 'Ваш результат броска',
      maxValue: 6
    },
    '🎯': {
      emoji: '🎯',
      actionText: 'Бросить дартс',
      processText: 'Бросаем дартс...',
      resultText: 'Ваш результат дартса',
      maxValue: 6
    },
    '⚽': {
      emoji: '⚽',
      actionText: 'Удар по мячу',
      processText: 'Бьем по мячу...',
      resultText: 'Ваш результат удара',
      maxValue: 5
    },
    '🏀': {
      emoji: '🏀',
      actionText: 'Бросок в корзину',
      processText: 'Бросаем в корзину...',
      resultText: 'Ваш результат броска',
      maxValue: 5
    },
    '🎳': {
      emoji: '🎳',
      actionText: 'Бросок в боулинге',
      processText: 'Бросаем боулинг...',
      resultText: 'Ваш результат в боулинге',
      maxValue: 6
    },
    '🎰': {
      emoji: '🎰',
      actionText: 'Крутить слоты',
      processText: 'Крутим слоты...',
      resultText: 'Ваш результат слотов',
      maxValue: 64
    }
  };
  return gameConfigs[gameType] || gameConfigs['🎲'];
}

// Функция создания игровых кнопок
function createGameButtons(sessionId, gameType) {
  const gameConfig = getGameConfig(gameType);
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${gameConfig.emoji} ${gameConfig.actionText}`, `play_game_${sessionId}`)],
    [Markup.button.callback('📊 Статус дуэли', `duel_status_${sessionId}`)]
  ]);
}

/**
 * Обработчик callback запросов (нажатия на inline кнопки)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerCallbackHandlers(bot) {
  
  console.log('🔧 Регистрируем callback handlers...');
  
  // Универсальный обработчик для отладки всех callback
  bot.on('callback_query', async (ctx, next) => {
    console.log('🔘 Callback query получен:', {
      data: ctx.callbackQuery.data,
      from: ctx.from.username,
      userId: ctx.from.id,
      messageId: ctx.callbackQuery.message?.message_id
    });
    await next();
  });
  
  // Обработка действий пополнения баланса
  bot.action(/^deposit:(\d+|custom)$/, async (ctx) => {
    try {
      const amount = ctx.match[1];
      
      console.log(`ДЕПОЗИТ: Обработка callback deposit:${amount}`);
      
      if (amount === 'custom') {
        // Устанавливаем флаг ожидания суммы депозита
        ctx.session = ctx.session || {};
        ctx.session.waitingForDepositAmount = true;
        
        await ctx.answerCbQuery();
        await ctx.reply(
          '💰 Введите сумму для пополнения (в USDT):\n\n' +
          'Минимум: 1 USDT\n' +
          'Максимум: 10000 USDT\n\n' +
          'Для отмены введите /cancel'
        );
        return;
      }
      
      // Валидация суммы
      const amountFloat = parseFloat(amount);
      console.log(`ДЕПОЗИТ: Parsed amount = ${amountFloat}`);
      
      if (isNaN(amountFloat) || amountFloat <= 0) {
        await ctx.reply('❌ Некорректная сумма для пополнения');
        return;
      }
      
      if (amountFloat < 1) {
        await ctx.reply('❌ Минимальная сумма пополнения: 1 USDT');
        return;
      }
      
      if (amountFloat > 10000) {
        await ctx.reply('❌ Максимальная сумма пополнения: 10000 USDT');
        return;
      }
      
      // Показываем индикатор загрузки
      await ctx.answerCbQuery('⏳ Создаем счет для оплаты...');
      
      console.log(`ДЕПОЗИТ: Создание депозита через API для пользователя ${ctx.from.id} на сумму ${amountFloat} USDT`);
      
      try {
        // Создаем депозит через API backend'а
        const depositData = await apiService.createDeposit(ctx.from, amountFloat, {
          source: 'bot',
          description: `Пополнение через Telegram бот на ${amountFloat} USDT`
        });
        
        console.log(`ДЕПОЗИТ: Депозит создан через API:`, depositData);
        
        // Отправляем пользователю ссылку на оплату
        await ctx.reply(
          `💰 Создан счет на пополнение баланса\n\n` +
          `💵 Сумма: ${amountFloat} USDT\n` +
          `🆔 ID депозита: ${depositData.depositId}\n` +
          `🧾 ID инвойса: ${depositData.invoiceId}\n` +
          `⏰ Срок действия: 1 час\n\n` +
          `Нажмите на кнопку ниже для оплаты:`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Оплатить', depositData.payUrl)],
            [Markup.button.callback('📋 Статус платежа', `check_deposit_status:${depositData.depositId}`)]
          ])
        );
        
      } catch (apiError) {
        console.error('ДЕПОЗИТ: Ошибка API при создании депозита:', apiError);
        await ctx.reply('❌ Не удалось создать счет для оплаты. Попробуйте позже.');
      }
      
    } catch (error) {
      console.error('ДЕПОЗИТ: Ошибка при обработке действия пополнения:', error);
      await ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.');
      await ctx.answerCbQuery('❌ Ошибка создания счета');
    }
  });

  // ============ ОБРАБОТЧИКИ ДУЭЛЕЙ ============
  
  // Принятие открытой дуэли
  bot.action(/^accept_open_duel_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;
      
      await ctx.answerCbQuery('⏳ Принимаем дуэль...');
      
      // Принимаем дуэль через API (backend проверит что это не инициатор)
      console.log('🔄 Отправляем запрос на принятие дуэли:', {
        sessionId, 
        userId, 
        username: ctx.from.username,
        headers: apiService.createTelegramAuthHeaders(ctx.from)
      });
      
      const result = await apiService.acceptDuel(sessionId, userId, ctx.from);
      
      if (result.success) {
        // Получаем данные дуэли для определения типа игры
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        const gameType = duelData.success ? duelData.data.gameType : '🎲';
        
        // Обновляем сообщение
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + `\n\n✅ **ДУЭЛЬ ПРИНЯТА!**\nОппонент: @${username}`,
          {
            parse_mode: 'Markdown',
            reply_markup: undefined
          }
        );
        
        // Создаем кнопки для игры с использованием типа игры
        const gameMarkup = createGameButtons(sessionId, gameType);
        
        await ctx.reply(
          `🎯 **Дуэль началась!**\n\n` +
          `🎮 Нажмите кнопку для игры\n` +
          `📋 ID сессии: \`${sessionId}\`\n\n` +
          `⚡ Игроки делают ходы по очереди`,
          { 
            parse_mode: 'Markdown',
            ...gameMarkup
          }
        );
      } else {
        await ctx.answerCbQuery(`❌ ${result.error || 'Ошибка принятия дуэли'}`);
      }
      
    } catch (error) {
      console.error('Ошибка принятия дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка принятия дуэли');
    }
  });

  // Отмена дуэли
  bot.action(/^cancel_duel_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      
      await ctx.answerCbQuery('⏳ Отменяем дуэль...');
      
      // Отменяем дуэль через API (backend проверит права на отмену)
      const result = await apiService.cancelDuel(sessionId, userId, ctx.from);
      
      if (result.success) {
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + `\n\n❌ **ДУЭЛЬ ОТМЕНЕНА**`,
          {
            parse_mode: 'Markdown',
            reply_markup: undefined
          }
        );
      } else {
        await ctx.answerCbQuery(`❌ ${result.error}`);
      }
      
    } catch (error) {
      console.error('Ошибка отмены дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка отмены дуэли');
    }
  });

  // Принятие персональной дуэли
  bot.action(/^accept_personal_duel_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;
      
      await ctx.answerCbQuery('⏳ Принимаем дуэль...');
      
      // Принимаем дуэль через API
      const result = await apiService.acceptDuel(sessionId, userId, ctx.from);
      
      if (result.success) {
        // Получаем данные дуэли для определения типа игры
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        const gameType = duelData.success ? duelData.data.gameType : '🎲';
        
        // Обновляем сообщение
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + `\n\n✅ **ДУЭЛЬ ПРИНЯТА!**\nОппонент: @${username}`,
          {
            parse_mode: 'Markdown',
            reply_markup: undefined
          }
        );
        
        // Создаем кнопки для игры с использованием типа игры
        const gameMarkup = createGameButtons(sessionId, gameType);
        
        await ctx.reply(
          `🎯 **Дуэль началась!**\n\n` +
          `🎮 Нажмите кнопку для игры\n` +
          `📋 ID сессии: \`${sessionId}\`\n\n` +
          `⚡ Игроки делают ходы по очереди`,
          { 
            parse_mode: 'Markdown',
            ...gameMarkup
          }
        );
      } else {
        await ctx.answerCbQuery(`❌ ${result.error}`);
      }
      
    } catch (error) {
      console.error('Ошибка принятия персональной дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка принятия дуэли');
    }
  });

  // Отклонение персональной дуэли
  bot.action(/^decline_personal_duel_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;
      
      await ctx.answerCbQuery('❌ Дуэль отклонена');
      
      // Отклоняем дуэль через API
      const result = await apiService.cancelDuel(sessionId, userId, ctx.from);
      
      if (result.success) {
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + `\n\n❌ **ДУЭЛЬ ОТКЛОНЕНА**\n@${username} отклонил(а) приглашение`,
          {
            parse_mode: 'Markdown',
            reply_markup: undefined
          }
        );
      } else {
        await ctx.answerCbQuery(`❌ ${result.error}`);
      }
      
    } catch (error) {
      console.error('Ошибка отклонения персональной дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка отклонения дуэли');
    }
  });

  // Показ правил игры
  bot.action(/^duel_rules_(.+)$/, async (ctx) => {
    try {
      const gameTypeCode = ctx.match[1];
      
      // Маппинг очищенных кодов обратно к эмодзи
      const gameTypeMap = {
        '': '🎲', // fallback
        'undefined': '🎲', // fallback
      };
      
      const gameType = gameTypeMap[gameTypeCode] || '🎲';
      
      const gameRules = {
        '🎲': 'Кости: Бросьте кость, у кого больше - тот выиграл раунд',
        '🎯': 'Дартс: Попадите в цель, лучший результат побеждает',
        '⚽': 'Футбол: Забейте гол, лучший результат побеждает',
        '🏀': 'Баскетбол: Попадите в корзину, лучший результат побеждает',
        '🎳': 'Боулинг: Сбейте кегли, больше кеглей = победа',
        '🎰': 'Слоты: Получите комбинацию, больше очков = победа'
      };
      
      await ctx.answerCbQuery(
        gameRules[gameType] || 'Правила для этой игры не найдены',
        { show_alert: true }
      );
      
    } catch (error) {
      console.error('Ошибка показа правил:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки правил');
    }
  });

  // ============ ОБРАБОТЧИКИ ИГРОВОГО ПРОЦЕССА ============
  
  // Игра в дуэли
  bot.action(/^play_game_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;
      
      // Получаем данные дуэли для определения типа игры
      const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      
      if (!duelData.success) {
        await ctx.answerCbQuery('❌ Ошибка получения данных дуэли');
        return;
      }
      
      const gameType = duelData.data.gameType;
      const gameConfig = getGameConfig(gameType);
      
      await ctx.answerCbQuery(`${gameConfig.emoji} ${gameConfig.processText}`);
      
      // Отправляем соответствующий Telegram dice
      const diceMessage = await ctx.replyWithDice(gameConfig.emoji);
      const gameResult = diceMessage.dice.value;
      
      console.log(`🎮 Игрок ${username} (${userId}) сыграл ${gameType}: ${gameResult} в дуэли ${sessionId}`);
      
      // Сначала отправляем результат текущему игроку
      const resultMessage = await ctx.reply(
        `${gameConfig.emoji} **${gameConfig.resultText}**\n\n` +
        `🎯 Результат: **${gameResult}**\n` +
        `📋 Сессия: \`${sessionId}\`\n\n` +
        `⏳ Ожидание хода противника...`,
        { parse_mode: 'Markdown' }
      );
      
      // Сохраняем messageId для будущих обновлений
      const messageId = resultMessage.message_id;
      
      // Сохраняем результат в API после получения результата
      const roundData = {
        userId,
        username,
        gameType: gameType,
        result: gameResult,
        timestamp: Date.now()
      };
      
      const saveResult = await apiService.saveDuelRound(sessionId, roundData);
      
      if (saveResult.success) {
        
        // Получаем данные дуэли для определения противника
        const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
        
        if (duelData.success) {
          const duel = duelData.data;
          const opponentId = duel.challengerId === userId ? duel.opponentId : duel.challengerId;
          const opponentUsername = duel.challengerId === userId ? duel.opponentUsername : duel.challengerUsername;
          
          // Проверяем статус дуэли после сохранения хода
          const updatedDuelData = await apiService.getDuelData(sessionId, userId, ctx.from);
          
          if (updatedDuelData.success) {
            const updatedDuel = updatedDuelData.data;
            
            // Проверяем завершилась ли дуэль
            if (updatedDuel.status === 'completed') {
              // Отображаем результаты дуэли
              const winnerUsername = updatedDuel.winnerId === userId ? username : opponentUsername;
              const loserUsername = updatedDuel.winnerId === userId ? opponentUsername : username;
              const isWinner = updatedDuel.winnerId === userId;
              
              // Отправляем новое сообщение с результатом
              await ctx.reply(
                `🏆 **ДУЭЛЬ ЗАВЕРШЕНА!** 🏆\n\n` +
                `${isWinner ? '🎉 **ПОЗДРАВЛЯЕМ!**' : '😢 **К СОЖАЛЕНИЮ...**'}\n\n` +
                `${gameConfig.emoji} Игра: ${getGameName(gameType)}\n` +
                `📊 Окончательный счёт: ${updatedDuel.challengerScore}:${updatedDuel.opponentScore}\n` +
                `👑 Победитель: @${winnerUsername}\n` +
                `💰 Выигрыш: ${updatedDuel.winAmount} USDT\n\n` +
                `🎯 Ваш результат: **${gameResult}**\n\n` +
                `📍 Результаты раундов:\n${roundsText}\n` +
                `📋 ID дуэли: \`${sessionId}\``,
                { parse_mode: 'Markdown' }
              );
              
              // Уведомляем противника о завершении
              if (opponentId) {
                try {
                  await ctx.telegram.sendMessage(
                    opponentId,
                    `🏆 **ДУЭЛЬ ЗАВЕРШЕНА!** 🏆\n\n` +
                    `${updatedDuel.winnerId === opponentId ? '🎉 **ПОЗДРАВЛЯЕМ!**' : '😢 **К СОЖАЛЕНИЮ...**'}\n\n` +
                    `${gameConfig.emoji} Игра: ${getGameName(gameType)}\n` +
                    `📊 Окончательный счёт: ${updatedDuel.challengerScore}:${updatedDuel.opponentScore}\n` +
                    `👑 Победитель: @${winnerUsername}\n` +
                    `💰 Выигрыш: ${updatedDuel.winAmount} USDT\n\n` +
                    `📍 Результаты раундов:\n`;
                  
                  // Добавляем результаты всех раундов
                  let roundsText = '';
                  if (updatedDuel.rounds && updatedDuel.rounds.length > 0) {
                    updatedDuel.rounds.forEach((round, index) => {
                      if (round.challengerResult !== null && round.opponentResult !== null) {
                        const challengerWon = round.winnerId === updatedDuel.challengerId;
                        roundsText += `• Раунд ${index + 1}: @${updatedDuel.challengerUsername} [${round.challengerResult}] vs @${updatedDuel.opponentUsername} [${round.opponentResult}] ${challengerWon ? '🅰️' : '🅱️'}\n`;
                      }
                    });
                  }
                  
                  await ctx.telegram.sendMessage(
                    opponentId,
                    `🏆 **ДУЭЛЬ ЗАВЕРШЕНА!** 🏆\n\n` +
                    `${updatedDuel.winnerId === opponentId ? '🎉 **ПОЗДРАВЛЯЕМ!**' : '😢 **К СОЖАЛЕНИЮ...**'}\n\n` +
                    `${gameConfig.emoji} Игра: ${getGameName(gameType)}\n` +
                    `📊 Окончательный счёт: ${updatedDuel.challengerScore}:${updatedDuel.opponentScore}\n` +
                    `👑 Победитель: @${winnerUsername}\n` +
                    `💰 Выигрыш: ${updatedDuel.winAmount} USDT\n\n` +
                    `📍 Результаты раундов:\n${roundsText}\n` +
                    `📋 ID дуэли: \`${sessionId}\``,
                    { parse_mode: 'Markdown' }
                  );
                } catch (notifyError) {
                  console.error('❌ Не удалось уведомить противника о завершении:', notifyError.message);
                }
              }
            } else {
              // Дуэль продолжается - уведомляем противника
              if (opponentId) {
                try {
                  const gameMarkup = Markup.inlineKeyboard([
                    [Markup.button.callback(`${gameConfig.emoji} ${gameConfig.actionText}`, `play_game_${sessionId}`)],
                    [Markup.button.callback('📊 Показать результаты', `show_results_${sessionId}`)]
                  ]);
                  
                  // Получаем текущий раунд
                  const currentRound = updatedDuel.rounds[updatedDuel.rounds.length - 1];
                  const isOpponentTurn = currentRound && currentRound.opponentResult === null;
                  
                  await ctx.telegram.sendMessage(
                    opponentId,
                    `${gameConfig.emoji} **Ход противника!**\n\n` +
                    `👤 @${username} сыграл ${getGameName(gameType)}: **${gameResult}**\n` +
                    `📊 Текущий счёт: ${updatedDuel.challengerScore}:${updatedDuel.opponentScore}\n` +
                    `🎲 Раунд: ${currentRound ? currentRound.roundNumber : 1}\n` +
                    `📋 ID: \`${sessionId}\`\n\n` +
                    `${isOpponentTurn ? '🎯 **Теперь ваш ход!**' : '⏳ Ожидание вашего хода...'}`,
                    { 
                      parse_mode: 'Markdown',
                      ...gameMarkup
                    }
                  );
                  console.log(`✅ Уведомление о ходе отправлено противнику ${opponentId}`);
                } catch (notifyError) {
                  console.error('❌ Не удалось уведомить противника:', notifyError.message);
                }
              }
            }
          }
        }
      } else {
        await ctx.reply(`❌ Ошибка сохранения результата: ${saveResult.error}`);
      }
      
    } catch (error) {
      console.error('Ошибка игрового процесса:', error);
      await ctx.answerCbQuery('❌ Ошибка игры');
    }
  });
  
  // Показ результатов раунда
  bot.action(/^show_results_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      
      await ctx.answerCbQuery('📊 Загружаем результаты...');
      
      // Получаем данные дуэли
      const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      
      if (duelData.success) {
        const duel = duelData.data;
        
        let resultsText = `📊 **Результаты дуэли**\n\n`;
        resultsText += `🆔 ID: \`${sessionId}\`\n`;
        resultsText += `🎮 Игра: ${getGameName(duel.gameType)} ${duel.gameType}\n`;
        resultsText += `🏆 Формат: ${duel.format.toUpperCase()} (до ${duel.winsRequired} побед)\n`;
        resultsText += `💰 Ставка: ${duel.amount} USDT\n`;
        resultsText += `💵 Банк: ${duel.totalAmount} USDT\n`;
        resultsText += `👑 Выигрыш: ${duel.winAmount} USDT\n\n`;
        
        resultsText += `👥 **Игроки:**\n`;
        resultsText += `• @${duel.challengerUsername} (инициатор)\n`;
        resultsText += `• @${duel.opponentUsername || '...'} (оппонент)\n\n`;
        
        resultsText += `📊 **Текущий счёт:** ${duel.challengerScore}:${duel.opponentScore}\n`;
        resultsText += `📍 **Статус:** ${duel.status}\n\n`;
        
        if (duel.rounds && duel.rounds.length > 0) {
          resultsText += `🎲 **Раунды:**\n`;
          duel.rounds.forEach((round, index) => {
            if (round.challengerResult !== null || round.opponentResult !== null) {
              resultsText += `\n**Раунд ${round.roundNumber}:**\n`;
              if (round.challengerResult !== null) {
                resultsText += `• @${duel.challengerUsername}: ${round.challengerResult}\n`;
              }
              if (round.opponentResult !== null) {
                resultsText += `• @${duel.opponentUsername}: ${round.opponentResult}\n`;
              }
              if (round.winnerId) {
                const winner = round.winnerId === duel.challengerId ? duel.challengerUsername : duel.opponentUsername;
                resultsText += `🏆 Победитель раунда: @${winner}\n`;
              }
            }
          });
        } else {
          resultsText += `📭 Раундов пока нет`;
        }
        
        // Если дуэль завершена
        if (duel.status === 'completed' && duel.winnerId) {
          resultsText += `\n\n🎆 **ДУЭЛЬ ЗАВЕРШЕНА!**\n`;
          resultsText += `👑 Победитель: @${duel.winnerUsername}\n`;
          resultsText += `💰 Выигрыш: ${duel.winAmount} USDT`;
        }
        
        await ctx.reply(resultsText, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`❌ Ошибка получения результатов: ${duelData.error}`);
      }
      
    } catch (error) {
      console.error('Ошибка показа результатов:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки');
    }
  });
  
  // Следующий раунд
  bot.action(/^next_round_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      
      await ctx.answerCbQuery('🔄 Подготовка следующего раунда...');
      
      // Получаем данные дуэли для определения типа игры
      const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      const gameType = duelData.success ? duelData.data.gameType : '🎲';
      
      // Создаем кнопки для следующего раунда с правильным типом игры
      const nextRoundMarkup = createGameButtons(sessionId, gameType);
      
      await ctx.reply(
        `🔄 **Следующий раунд**\n\n` +
        `🎮 Нажмите кнопку для игры\n` +
        `📋 Сессия: \`${sessionId}\``,
        { 
          parse_mode: 'Markdown',
          ...nextRoundMarkup
        }
      );
      
    } catch (error) {
      console.error('Ошибка следующего раунда:', error);
      await ctx.answerCbQuery('❌ Ошибка раунда');
    }
  });
  
  // Статус дуэли
  bot.action(/^duel_status_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      
      await ctx.answerCbQuery('📊 Проверяем статус...');
      
      // Получаем данные дуэли
      const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      
      if (duelData.success) {
        const duel = duelData.data;
        
        let statusText = `📋 **Статус дуэли**\n\n`;
        statusText += `🆔 ID: \`${sessionId}\`\n`;
        statusText += `🎮 Игра: ${duel.gameType}\n`;
        statusText += `💰 Ставка: ${duel.amount} USDT\n`;
        statusText += `🏆 Формат: ${duel.format}\n`;
        statusText += `📊 Статус: ${duel.status}\n\n`;
        
        if (duel.challengerUsername && duel.opponentUsername) {
          statusText += `👥 **Игроки:**\n`;
          statusText += `• @${duel.challengerUsername}\n`;
          statusText += `• @${duel.opponentUsername}\n\n`;
        }
        
        if (duel.rounds && duel.rounds.length > 0) {
          statusText += `📈 Раундов сыграно: ${duel.rounds.length}`;
        }
        
        await ctx.reply(statusText, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`❌ Ошибка получения статуса: ${duelData.error}`);
      }
      
    } catch (error) {
      console.error('Ошибка статуса дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка статуса');
    }
  });

  // ============ ОБРАБОТЧИКИ INLINE ДУЭЛЕЙ ============
  
  // Принятие inline дуэли (новый формат с коротким ID)
  bot.action(/^inline_accept_(.+)$/, async (ctx) => {
    try {
      const shortId = ctx.match[1];
      const acceptorId = ctx.from.id.toString();
      const acceptorUsername = ctx.from.username;
      
      console.log(`🎯 Принятие inline дуэли по shortId: ${shortId}`);
      
      // Получаем данные дуэли из глобального хранилища
      if (!global.inlineDuelData || !global.inlineDuelData[shortId]) {
        return await ctx.answerCbQuery('❌ Данные дуэли не найдены или устарели');
      }
      
      const duelData = global.inlineDuelData[shortId];
      const { challengerId, challengerUsername, targetUsername, amount, gameType, format } = duelData;
      
      console.log('📋 Данные дуэли:', {
        challengerId,
        challengerUsername,
        targetUsername,
        amount,
        gameType,
        format,
        acceptorId,
        acceptorUsername
      });
      
      // Проверяем что пользователь принимает свой вызов
      if (acceptorUsername !== targetUsername) {
        return await ctx.answerCbQuery('❌ Это приглашение не для вас');
      }
      
      await ctx.answerCbQuery('⏳ Создаем дуэль...');
      
      try {
        // Создаем дуэль через API
        const chatId = ctx.chat?.id?.toString() || ctx.callbackQuery?.message?.chat?.id?.toString() || 'inline_private';
        
        console.log('🔄 Создание дуэли через API:', {
          challengerId,
          challengerUsername,
          opponentId: acceptorId,
          opponentUsername: acceptorUsername,
          gameType,
          format,
          amount,
          chatId
        });
        
        const duelApiData = await apiService.createDuel({
          challengerId,
          challengerUsername,
          opponentId: acceptorId,
          opponentUsername: acceptorUsername,
          gameType,
          format,
          amount,
          chatId,
          chatType: 'private'
        }, ctx.from);
        
        if (duelApiData.success) {
          const sessionId = duelApiData.data.sessionId;
          
          await ctx.editMessageText(
            `${gameType} **ДУЭЛЬ ПРИНЯТА!** ${gameType}\n\n` +
            `🎮 Игра: ${getGameName(gameType)}\n` +
            `💰 Ставка: ${amount} USDT каждый\n` +
            `🏆 Формат: ${format.toUpperCase()}\n` +
            `👥 Игроки: @${challengerUsername} vs @${acceptorUsername}\n\n` +
            `✅ **Дуэль началась! Играйте в личных чатах с ботом**\n` +
            `📋 ID: \`${sessionId}\``,
            {
              parse_mode: 'Markdown',
              reply_markup: undefined
            }
          );
          
          // Создаем игровые кнопки для inline дуэли
          const gameMarkup = createGameButtons(sessionId, gameType);
          
          // Отправляем игровое сообщение принявшему игроку В ЛИЧКУ
          try {
            await ctx.telegram.sendMessage(
              acceptorId,
              `🎯 **Дуэль началась!**\n\n` +
              `👤 Противник: @${challengerUsername}\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `💰 Ставка: ${amount} USDT\n` +
              `📋 ID: \`${sessionId}\`\n\n` +
              `${gameType} Ваш ход! Нажмите кнопку для игры:`,
              { 
                parse_mode: 'Markdown',
                ...gameMarkup
              }
            );
            console.log(`✅ Игровое сообщение отправлено принявшему игроку ${acceptorId}`);
          } catch (sendError) {
            console.error('❌ Не удалось отправить игровое сообщение принявшему:', sendError.message);
          }
          
          // Отправляем игровое сообщение инициатору В ЛИЧКУ
          try {
            await ctx.telegram.sendMessage(
              challengerId,
              `🎯 **Ваша дуэль принята!**\n\n` +
              `👤 Противник: @${acceptorUsername}\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `💰 Ставка: ${amount} USDT\n` +
              `📋 ID: \`${sessionId}\`\n\n` +
              `${gameType} Ваш ход! Нажмите кнопку для игры:`,
              { 
                parse_mode: 'Markdown',
                ...gameMarkup
              }
            );
            console.log(`✅ Игровое сообщение отправлено инициатору ${challengerId}`);
          } catch (sendError) {
            console.error('❌ Не удалось отправить игровое сообщение инициатору:', sendError.message);
          }
          
          // Удаляем данные из временного хранилища
          delete global.inlineDuelData[shortId];
          
        } else {
          await ctx.answerCbQuery(`❌ ${duelApiData.error}`);
        }
        
      } catch (error) {
        console.error('Ошибка создания inline дуэли:', error);
        await ctx.answerCbQuery('❌ Ошибка создания дуэли: ' + error.message);
      }
      
    } catch (error) {
      console.error('Ошибка обработки inline принятия:', error);
      await ctx.answerCbQuery('❌ Ошибка обработки');
    }
  });
  
  // Отклонение inline дуэли (новый формат)
  bot.action(/^inline_decline_(.+)$/, async (ctx) => {
    try {
      const shortId = ctx.match[1];
      const acceptorUsername = ctx.from.username;
      
      console.log(`❌ Отклонение inline дуэли по shortId: ${shortId}`);
      
      // Получаем данные дуэли
      if (global.inlineDuelData && global.inlineDuelData[shortId]) {
        const duelData = global.inlineDuelData[shortId];
        const challengerId = duelData.challengerId;
        
        await ctx.answerCbQuery('❌ Дуэль отклонена');
        
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + `\n\n❌ **ДУЭЛЬ ОТКЛОНЕНА**\n@${acceptorUsername} отклонил(а) приглашение`,
          {
            parse_mode: 'Markdown',
            reply_markup: undefined
          }
        );
        
        // Уведомляем инициатора
        try {
          await ctx.telegram.sendMessage(
            challengerId,
            `❌ **Дуэль отклонена**\n\n@${acceptorUsername} отклонил(а) ваше приглашение на дуэль.`,
            { parse_mode: 'Markdown' }
          );
        } catch (notifyError) {
          console.log('Не удалось уведомить инициатора об отклонении:', notifyError.message);
        }
        
        // Удаляем данные
        delete global.inlineDuelData[shortId];
      } else {
        await ctx.answerCbQuery('❌ Данные дуэли не найдены');
      }
      
    } catch (error) {
      console.error('Ошибка отклонения inline дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка отклонения');
    }
  });
  
  // Старый обработчик для совместимости
  bot.action(/^duel_accept_(\d+)_(\w+)_(\w+)_(\d+)_(.+)_(.+)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const challengerUsername = ctx.match[2];
      const targetUsername = ctx.match[3];
      const amount = parseInt(ctx.match[4]);
      const gameType = ctx.match[5];
      const format = ctx.match[6];
      const acceptorId = ctx.from.id.toString();
      const acceptorUsername = ctx.from.username;
      
      console.log('🎯 Парсинг принятия дуэли:', {
        challengerId,
        challengerUsername,
        targetUsername,
        amount,
        gameType,
        format,
        acceptorId,
        acceptorUsername
      });
      
      // Проверяем что пользователь принимает свой вызов
      if (acceptorUsername !== targetUsername) {
        return await ctx.answerCbQuery('❌ Это приглашение не для вас');
      }
      
      await ctx.answerCbQuery('⏳ Создаем дуэль...');
      
      try {
        // Создаем дуэль через API
        const chatId = ctx.chat?.id?.toString() || ctx.callbackQuery?.message?.chat?.id?.toString() || 'inline_private';
        
        console.log('🔄 Создание дуэли через API:', {
          challengerId,
          challengerUsername,
          opponentId: acceptorId,
          opponentUsername: acceptorUsername,
          gameType,
          format,
          amount,
          chatId
        });
        
        const duelData = await apiService.createDuel({
          challengerId,
          challengerUsername,
          opponentId: acceptorId,
          opponentUsername: acceptorUsername,
          gameType,
          format,
          amount,
          chatId,
          chatType: 'private'
        }, ctx.from);
        
        if (duelData.success) {
          const sessionId = duelData.data.sessionId;
          
          await ctx.editMessageText(
            `${gameType} **ДУЭЛЬ ПРИНЯТА!** ${gameType}\n\n` +
            `🎮 Игра: ${getGameName(gameType)}\n` +
            `💰 Ставка: ${amount} USDT каждый\n` +
            `🏆 Формат: ${format.toUpperCase()}\n` +
            `👥 Игроки: @${challengerUsername} vs @${acceptorUsername}\n\n` +
            `✅ **Дуэль началась! Играйте в личных чатах с ботом**\n` +
            `📋 ID: \`${sessionId}\``,
            {
              parse_mode: 'Markdown',
              reply_markup: undefined
            }
          );
          
          // Создаем игровые кнопки для inline дуэли
          const gameMarkup = createGameButtons(sessionId, gameType);
          
          // Отправляем игровое сообщение принявшему игроку В ЛИЧКУ
          try {
            await ctx.telegram.sendMessage(
              acceptorId,
              `🎯 **Дуэль началась!**\n\n` +
              `👤 Противник: @${challengerUsername}\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `💰 Ставка: ${amount} USDT\n` +
              `📋 ID: \`${sessionId}\`\n\n` +
              `${gameType} Ваш ход! Нажмите кнопку для игры:`,
              { 
                parse_mode: 'Markdown',
                ...gameMarkup
              }
            );
            console.log(`✅ Игровое сообщение отправлено принявшему игроку ${acceptorId}`);
          } catch (sendError) {
            console.error('❌ Не удалось отправить игровое сообщение принявшему:', sendError.message);
          }
          
          // Отправляем игровое сообщение инициатору В ЛИЧКУ
          try {
            await ctx.telegram.sendMessage(
              challengerId,
              `🎯 **Ваша дуэль принята!**\n\n` +
              `👤 Противник: @${acceptorUsername}\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `💰 Ставка: ${amount} USDT\n` +
              `📋 ID: \`${sessionId}\`\n\n` +
              `${gameType} Ваш ход! Нажмите кнопку для игры:`,
              { 
                parse_mode: 'Markdown',
                ...gameMarkup
              }
            );
            console.log(`✅ Игровое сообщение отправлено инициатору ${challengerId}`);
          } catch (sendError) {
            console.error('❌ Не удалось отправить игровое сообщение инициатору:', sendError.message);
          }
          
        } else {
          await ctx.answerCbQuery(`❌ ${duelData.error}`);
        }
        
      } catch (error) {
        console.error('Ошибка создания inline дуэли:', error);
        await ctx.answerCbQuery('❌ Ошибка создания дуэли: ' + error.message);
      }
      
    } catch (error) {
      console.error('Ошибка обработки inline принятия:', error);
      await ctx.answerCbQuery('❌ Ошибка обработки');
    }
  });

  // Старое отклонение inline дуэли (для совместимости)
  bot.action(/^duel_decline_(\d+)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const acceptorUsername = ctx.from.username;
      
      await ctx.answerCbQuery('❌ Дуэль отклонена');
      
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + `\n\n❌ **ДУЭЛЬ ОТКЛОНЕНА**\n@${acceptorUsername} отклонил(а) приглашение`,
        {
          parse_mode: 'Markdown',
          reply_markup: undefined
        }
      );
      
      // Уведомляем инициатора
      try {
        await ctx.telegram.sendMessage(
          challengerId,
          `❌ **Дуэль отклонена**\n\n@${acceptorUsername} отклонил(а) ваше приглашение на дуэль.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.log('Не удалось уведомить инициатора об отклонении:', notifyError.message);
      }
      
    } catch (error) {
      console.error('Ошибка отклонения inline дуэли:', error);
      await ctx.answerCbQuery('❌ Ошибка отклонения');
    }
  });
  
  // Обработка проверки статуса депозита
  bot.action(/^check_deposit_status:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const depositId = ctx.match[1];
      
      console.log(`СТАТУС: Проверка статуса депозита: ${depositId}`);
      
      await ctx.answerCbQuery('⏳ Проверяем статус депозита...');
      
      const depositInfo = await apiService.getDepositStatus(ctx.from, depositId);
      
      let statusMessage = '';
      let statusEmoji = '';
      
      switch (depositInfo.status) {
        case 'pending':
          statusEmoji = '⏳';
          statusMessage = 'Ожидает оплаты';
          break;
        case 'paid':
          statusEmoji = '✅';
          statusMessage = 'Оплачен - средства зачислены на баланс';
          break;
        case 'expired':
          statusEmoji = '⏰';
          statusMessage = 'Истек срок действия';
          break;
        default:
          statusEmoji = '❓';
          statusMessage = 'Неизвестный статус';
      }
      
      await ctx.reply(
        `📊 Статус депозита\n\n` +
        `🆔 ID: ${depositInfo.id}\n` +
        `💵 Сумма: ${depositInfo.amount} USDT\n` +
        `${statusEmoji} Статус: ${statusMessage}\n` +
        `📅 Создан: ${new Date(depositInfo.createdAt).toLocaleString('ru-RU')}`
      );
      
    } catch (error) {
      console.error('СТАТУС: Ошибка при проверке статуса депозита:', error);
      await ctx.reply('❌ Не удалось проверить статус депозита');
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  });

  // Обработка действий вывода средств
  bot.action(/^withdraw:(\d+|custom)$/, async (ctx) => {
    try {
      const amount = ctx.match[1];
      
      console.log(`ВЫВОД: Обработка callback withdraw:${amount}`);
      
      // Сохраняем сумму в сессии
      ctx.session = ctx.session || {};
      
      if (amount === 'custom') {
        // Устанавливаем флаг ожидания суммы вывода
        ctx.session.waitingForWithdrawAmount = true;
        
        await ctx.answerCbQuery();
        await ctx.reply(
          '💰 Введите сумму для вывода (в USDT):\n\n' +
          'Минимум: 1 USDT\n' +
          'Максимум: 10000 USDT\n\n' +
          'Для отмены введите /cancel'
        );
        return;
      }
      
      // Валидация суммы
      const amountFloat = parseFloat(amount);
      
      if (isNaN(amountFloat) || amountFloat <= 0) {
        await ctx.reply('❌ Некорректная сумма для вывода');
        return;
      }
      
      if (amountFloat < 1) {
        await ctx.reply('❌ Минимальная сумма вывода: 1 USDT');
        return;
      }
      
      if (amountFloat > 10000) {
        await ctx.reply('❌ Максимальная сумма вывода: 10000 USDT');
        return;
      }
      
      // Проверяем баланс пользователя
      await ctx.answerCbQuery('⏳ Проверяем баланс...');
      
      const balance = await apiService.getUserBalance(ctx.from);
      
      if (balance < amountFloat) {
        await ctx.reply(`❌ Недостаточно средств\n\nВаш баланс: ${balance.toFixed(2)} USDT\nЗапрошено: ${amountFloat} USDT`);
        return;
      }
      
      // Сохраняем сумму и запрашиваем получателя
      ctx.session.withdrawAmount = amountFloat;
      ctx.session.waitingForWithdrawRecipient = true;
      
      await ctx.reply(
        '📤 Куда вывести средства?\n\n' +
        'Введите Telegram username получателя (без @):\n\n' +
        '⚠️ Важно:\n' +
        '• Получатель должен быть зарегистрирован в @CryptoBot\n' +
        '• Username вводится без символа @\n' +
        '• Проверьте правильность username перед отправкой\n\n' +
        'Для отмены введите /cancel'
      );
      
    } catch (error) {
      console.error('ВЫВОД: Ошибка при обработке действия вывода:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      await ctx.answerCbQuery('❌ Ошибка');
    }
  });

  // Обработка подтверждения вывода
  bot.action(/^confirm_withdraw:(.+)$/, async (ctx) => {
    try {
      const data = ctx.match[1];
      const [amount, recipient] = data.split(':');
      
      await ctx.answerCbQuery('⏳ Создаем запрос на вывод...');
      
      console.log(`ВЫВОД: Подтверждение вывода ${amount} USDT для ${recipient}`);
      
      try {
        // Создаем запрос на вывод через API
        const withdrawalData = await apiService.createWithdrawal(ctx.from, {
          amount: parseFloat(amount),
          recipient: recipient,
          recipientType: 'username',
          comment: `Вывод через Telegram бот`
        });
        
        console.log(`ВЫВОД: Запрос на вывод создан:`, withdrawalData);
        
        // Формируем сообщение в зависимости от суммы
        let message = `✅ Запрос на вывод создан\n\n` +
          `💵 Сумма: ${amount} USDT\n` +
          `📤 Получатель: @${recipient}\n` +
          `🆔 ID вывода: ${withdrawalData.withdrawalId}\n`;
        
        if (withdrawalData.requiresApproval) {
          message += `\n⏳ Статус: Требует одобрения администратора\n` +
            `⏰ Время обработки: 24-48 часов`;
        } else {
          message += `\n⚡ Статус: Автоматическая обработка\n` +
            `⏰ Время обработки: 5-15 минут`;
        }
        
        await ctx.editMessageText(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('📊 Проверить статус', `check_withdrawal_status:${withdrawalData.withdrawalId}`)],
            [Markup.button.callback('📋 История выводов', 'withdrawals_history')]
          ])
        );
        
        // Очищаем сессию
        delete ctx.session.withdrawAmount;
        delete ctx.session.withdrawRecipient;
        delete ctx.session.waitingForWithdrawAmount;
        delete ctx.session.waitingForWithdrawRecipient;
        
      } catch (apiError) {
        console.error('ВЫВОД: Ошибка API при создании вывода:', apiError);
        
        let errorMessage = '❌ Не удалось создать запрос на вывод\n\n';
        
        if (apiError.message.includes('Недостаточно средств')) {
          errorMessage += 'Недостаточно средств на балансе';
        } else if (apiError.message.includes('активный запрос')) {
          errorMessage += 'У вас уже есть активный запрос на вывод';
        } else if (apiError.message.includes('username')) {
          errorMessage += 'Некорректный username получателя';
        } else {
          errorMessage += apiError.message || 'Попробуйте позже';
        }
        
        await ctx.editMessageText(errorMessage);
      }
      
    } catch (error) {
      console.error('ВЫВОД: Ошибка при подтверждении вывода:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      await ctx.answerCbQuery('❌ Ошибка');
    }
  });

  // Обработка отмены вывода
  bot.action('cancel_withdraw', async (ctx) => {
    await ctx.answerCbQuery('Отменено');
    
    // Очищаем сессию
    ctx.session = ctx.session || {};
    delete ctx.session.withdrawAmount;
    delete ctx.session.withdrawRecipient;
    delete ctx.session.waitingForWithdrawAmount;
    delete ctx.session.waitingForWithdrawRecipient;
    
    await ctx.editMessageText('❌ Вывод средств отменен');
  });

  // Обработка истории выводов
  bot.action('withdrawals_history', async (ctx) => {
    try {
      console.log(`ИСТОРИЯ ВЫВОДОВ: Запрос от пользователя ${ctx.from.id}`);
      
      await ctx.answerCbQuery('⏳ Загружаем историю выводов...');
      
      // Получаем историю выводов через API
      const withdrawalsData = await apiService.getUserWithdrawals(ctx.from, { limit: 10 });
      
      if (!withdrawalsData.withdrawals || withdrawalsData.withdrawals.length === 0) {
        await ctx.reply('📋 У вас пока нет запросов на вывод средств');
        return;
      }
      
      // Формируем сообщение с историей
      let message = '📋 История выводов (последние 10):\n\n';
      
      for (const withdrawal of withdrawalsData.withdrawals) {
        const date = new Date(withdrawal.createdAt).toLocaleDateString('ru-RU');
        let statusEmoji = '';
        let statusText = '';
        
        switch (withdrawal.status) {
          case 'pending':
            statusEmoji = '⏳';
            statusText = 'Ожидает';
            break;
          case 'approved':
            statusEmoji = '✅';
            statusText = 'Одобрен';
            break;
          case 'processing':
            statusEmoji = '⚙️';
            statusText = 'Обрабатывается';
            break;
          case 'completed':
            statusEmoji = '✅';
            statusText = 'Выполнен';
            break;
          case 'rejected':
            statusEmoji = '❌';
            statusText = 'Отклонен';
            break;
          case 'failed':
            statusEmoji = '⚠️';
            statusText = 'Ошибка';
            break;
        }
        
        message += `${statusEmoji} ${date} - ${withdrawal.amount} USDT\n`;
        message += `   Получатель: ${withdrawal.recipient}\n`;
        message += `   Статус: ${statusText}\n`;
        
        if (withdrawal.rejectionReason) {
          message += `   Причина: ${withdrawal.rejectionReason}\n`;
        }
        
        message += '\n';
      }
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ИСТОРИЯ ВЫВОДОВ: Ошибка при получении истории:', error);
      await ctx.reply('❌ Не удалось загрузить историю выводов');
    }
  });
  
  // Обработка проверки статуса вывода
  bot.action(/^check_withdrawal_status:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const withdrawalId = ctx.match[1];
      
      console.log(`СТАТУС ВЫВОДА: Проверка статуса вывода: ${withdrawalId}`);
      
      await ctx.answerCbQuery('⏳ Проверяем статус вывода...');
      
      const withdrawalInfo = await apiService.getWithdrawalStatus(ctx.from, withdrawalId);
      
      let statusMessage = '';
      let statusEmoji = '';
      
      switch (withdrawalInfo.status) {
        case 'pending':
          statusEmoji = '⏳';
          statusMessage = withdrawalInfo.amount > 300 
            ? 'Ожидает одобрения администратора' 
            : 'Ожидает обработки';
          break;
        case 'approved':
          statusEmoji = '✅';
          statusMessage = 'Одобрен администратором';
          break;
        case 'processing':
          statusEmoji = '⚙️';
          statusMessage = 'Обрабатывается системой';
          break;
        case 'completed':
          statusEmoji = '✅';
          statusMessage = 'Успешно выполнен';
          break;
        case 'rejected':
          statusEmoji = '❌';
          statusMessage = 'Отклонен администратором';
          break;
        case 'failed':
          statusEmoji = '⚠️';
          statusMessage = 'Ошибка при обработке';
          break;
      }
      
      let replyMessage = `📊 Статус вывода\n\n` +
        `🆔 ID: ${withdrawalInfo.id}\n` +
        `💵 Сумма: ${withdrawalInfo.amount} USDT\n` +
        `${statusEmoji} Статус: ${statusMessage}\n` +
        `📅 Создан: ${new Date(withdrawalInfo.createdAt).toLocaleString('ru-RU')}`;
      
      if (withdrawalInfo.processedAt) {
        replyMessage += `\n✅ Обработан: ${new Date(withdrawalInfo.processedAt).toLocaleString('ru-RU')}`;
      }
      
      if (withdrawalInfo.rejectionReason) {
        replyMessage += `\n\n❌ Причина отклонения: ${withdrawalInfo.rejectionReason}`;
      }
      
      await ctx.reply(replyMessage);
      
    } catch (error) {
      console.error('СТАТУС ВЫВОДА: Ошибка при проверке статуса:', error);
      await ctx.reply('❌ Не удалось проверить статус вывода');
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  });

}

module.exports = {
  registerCallbackHandlers
};
