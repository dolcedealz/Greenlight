// inline.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Обработчик inline запросов (запросы через @botname в чатах)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerInlineHandlers(bot) {
  // Обработка inline запросов для создания вызовов на игру в монетку
  bot.on('inline_query', async (ctx) => {
    try {
      const { webAppUrl } = config;
      const query = ctx.inlineQuery.query.toLowerCase().trim();
      const userId = ctx.inlineQuery.from.id.toString();
      const username = ctx.inlineQuery.from.username;
      
      // Создаем варианты inline результатов
      const results = [];

      // Парсим команду дуэли: "дуэль @username 50" или "дуэль 50"
      const duelMatch = query.match(/^дуэль\s*(@?\w+)?\s*(\d+(?:\.\d+)?)?$/);
      
      if (duelMatch) {
        const targetUsername = duelMatch[1]?.replace('@', '');
        const amount = parseFloat(duelMatch[2]);
        
        if (amount && amount >= 1 && amount <= 1000) {
          const duelTitle = targetUsername 
            ? `🎯 Дуэль с @${targetUsername} на ${amount} USDT`
            : `🎯 Дуэль на ${amount} USDT`;
            
          const duelDescription = targetUsername
            ? `Вызвать @${targetUsername} на дуэль в монетку`
            : `Предложить дуэль в монетку на ${amount} USDT`;

          results.push({
            type: 'article',
            id: `pvp_duel_${amount}_${targetUsername || 'any'}`,
            title: duelTitle,
            description: duelDescription,
            thumb_url: 'https://i.imgur.com/duel-coin.png',
            input_message_content: {
              message_text: targetUsername 
                ? `🎯 **ИГРОВАЯ КОМНАТА СОЗДАНА** 🪙\n\n👤 @${username} создал(а) дуэль с @${targetUsername}!\n💰 Ставка: ${amount} USDT каждый\n🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (5% комиссия)\n\n🚪 Оба игрока должны войти в комнату и подтвердить готовность!`
                : `🎯 **ИГРОВАЯ КОМНАТА СОЗДАНА** 🪙\n\n👤 @${username} создал(а) открытую дуэль!\n💰 Ставка: ${amount} USDT каждый\n🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (5% комиссия)\n\n🚪 Любой может войти в комнату и принять вызов!`,
              parse_mode: 'Markdown'
            },
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.webApp('🎮 Создать дуэль', `${webAppUrl}?pvp=create&challengerId=${userId}&amount=${amount}&target=${targetUsername || 'open'}`)],
              [Markup.button.switchToPM('💬 Управление через бота', `pvp_manage_${userId}_${amount}`)]
            ])
          });
        } else if (duelMatch[1] && !amount) {
          // Только username без суммы - показываем варианты сумм
          results.push(
            ...generateDuelAmountOptions(userId, username, targetUsername)
          );
        } else if (!duelMatch[1] && amount) {
          // Только сумма без username - показываем общий вызов
          results.push({
            type: 'article',
            id: `pvp_open_duel_${amount}`,
            title: `🎯 Открытая дуэль на ${amount} USDT`,
            description: 'Предложить дуэль всем участникам чата',
            thumb_url: 'https://i.imgur.com/duel-coin.png',
            input_message_content: {
              message_text: `🎯 **ОТКРЫТАЯ ИГРОВАЯ КОМНАТА** 🪙\n\n👤 @${username} создал(а) открытую дуэль!\n💰 Ставка: ${amount} USDT каждый\n🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (5% комиссия)\n\n🚪 Любой может войти в комнату и принять вызов!`,
              parse_mode: 'Markdown'
            },
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.webApp('🎮 Создать дуэль', `${webAppUrl}?pvp=create&challengerId=${userId}&amount=${amount}&target=open`)],
              [Markup.button.switchToPM('💬 Управление через бота', `pvp_manage_${userId}_${amount}`)]
            ])
          });
        }
      }
      
      // Если запрос начинается с "дуэль" но не распознан, показываем помощь
      if (query.startsWith('дуэль') && results.length === 0) {
        results.push({
          type: 'article',
          id: 'pvp_help',
          title: '❓ Как создать дуэль',
          description: 'Инструкция по созданию PvP дуэли',
          thumb_url: 'https://i.imgur.com/help-icon.png',
          input_message_content: {
            message_text: `📖 **Как создать дуэль:**\n\n• \`дуэль @username 50\` - вызвать конкретного игрока\n• \`дуэль 50\` - открытый вызов на 50 USDT\n• \`дуэль @john\` - выбрать сумму для игрока\n\n💰 Минимум: 1 USDT, Максимум: 1000 USDT\n🏆 Банк = Ставка × 2 - 5% комиссия`,
            parse_mode: 'Markdown'
          }
        });
      }
      
      // Если не дуэль, показываем стандартные варианты
      if (!query.startsWith('дуэль')) {
        // Старый функционал для монетки
        results.push({
          type: 'article',
          id: 'coin_challenge',
          title: 'Вызвать на игру в Монетку',
          description: 'Бросьте вызов другу в игре "Монетка"',
          thumb_url: 'https://i.imgur.com/YlQqmaH.png',
          input_message_content: {
            message_text: '🪙 Я вызываю тебя на игру в "Монетка"! Кто победит?'
          },
          reply_markup: Markup.inlineKeyboard([
            Markup.button.webApp('Принять вызов', `${webAppUrl}?game=coin&challenge=true`)
          ])
        });

        // Вариант PvP дуэли
        results.push({
          type: 'article',
          id: 'pvp_duel_quick',
          title: '⚔️ PvP Дуэль в Монетку',
          description: 'Создать дуэль с реальными ставками',
          thumb_url: 'https://i.imgur.com/duel-pvp.png',
          input_message_content: {
            message_text: '⚔️ Хочешь сразиться со мной в **PvP дуэли**?\n\n🪙 Монетка решит всё!\n💰 Ставим реальные деньги\n🏆 Победитель забирает банк\n\nНапиши: `дуэль @username сумма`',
            parse_mode: 'Markdown'
          }
        });
        
        // События (если запрос соответствует)
        if (query.includes('событ') || query.includes('ивент')) {
          results.push({
            type: 'article',
            id: 'events',
            title: 'События и прогнозы',
            description: 'Делайте ставки на события и прогнозы',
            thumb_url: 'https://i.imgur.com/KgUvuHC.png',
            input_message_content: {
              message_text: '🔮 Проверьте новые события и сделайте свои прогнозы!'
            },
            reply_markup: Markup.inlineKeyboard([
              Markup.button.webApp('Открыть события', `${webAppUrl}?screen=events`)
            ])
          });
        }
      }
      
      // Отправляем результаты
      await ctx.answerInlineQuery(results, {
        cache_time: 0, // Не кэшируем для актуальности данных
        is_personal: true
      });
    } catch (error) {
      console.error('Ошибка при обработке inline запроса:', error);
      await ctx.answerInlineQuery([]);
    }
  });
  
  return bot;
}

/**
 * Генерирует варианты сумм для дуэли с конкретным игроком
 */
function generateDuelAmountOptions(challengerId, challengerUsername, targetUsername) {
  const amounts = [1, 5, 10, 25, 50, 100];
  return amounts.map(amount => ({
    type: 'article',
    id: `pvp_preset_${amount}_${targetUsername}`,
    title: `💰 Дуэль с @${targetUsername} на ${amount} USDT`,
    description: `Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (комиссия 5%)`,
    thumb_url: 'https://i.imgur.com/coin-stack.png',
    input_message_content: {
      message_text: `🎯 **ИГРОВАЯ КОМНАТА СОЗДАНА** 🪙\n\n👤 @${challengerUsername} создал(а) дуэль с @${targetUsername}!\n💰 Ставка: ${amount} USDT каждый\n🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (5% комиссия)\n\n🚪 Оба игрока должны войти в комнату и подтвердить готовность!`,
      parse_mode: 'Markdown'
    },
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.webApp('🎮 Создать дуэль', `${webAppUrl}?pvp=create&challengerId=${challengerId}&amount=${amount}&target=${targetUsername}`)],
      [Markup.button.switchToPM('💬 Управление через бота', `pvp_manage_${challengerId}_${amount}`)]
    ])
  }));
}

module.exports = {
  registerInlineHandlers
};