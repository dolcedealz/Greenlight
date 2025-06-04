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

      if (query.startsWith('дуэль')) {
        const match = query.match(/^дуэль\s*(@?\w+)?\s*(\d+)?$/);
        
        if (match) {
          const targetUsername = match[1]?.replace('@', '');
          const amount = parseFloat(match[2]) || null;
          
          // Генерируем варианты
          if (!amount) {
            // Показать preset суммы
            results.push(...[10, 25, 50, 100, 250, 500].map(sum => ({
              type: 'article',
              id: `duel_${sum}`,
              title: `🪙 Дуэль на ${sum} USDT`,
              description: targetUsername 
                ? `Вызвать @${targetUsername}` 
                : 'Открытый вызов',
              input_message_content: {
                message_text: createDuelMessage(username, targetUsername, sum),
                parse_mode: 'Markdown'
              },
              reply_markup: createDuelKeyboard(userId, targetUsername, sum)
            })));
          } else {
            // Конкретная сумма
            results.push({
              type: 'article',
              id: `duel_custom_${amount}`,
              title: `🪙 Дуэль на ${amount} USDT`,
              description: getDuelDescription(targetUsername),
              input_message_content: {
                message_text: createDuelMessage(username, targetUsername, amount),
                parse_mode: 'Markdown'
              },
              reply_markup: createDuelKeyboard(userId, targetUsername, amount)
            });
          }
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

// Helper functions for duel creation
function createDuelMessage(challenger, target, amount) {
  return `🪙 **ВЫЗОВ НА ДУЭЛЬ** 🪙\n\n` +
    `👤 ${challenger} ${target ? `вызывает @${target}` : 'бросает открытый вызов'}\n` +
    `💰 Ставка: ${amount} USDT каждый\n` +
    `🏆 Призовой фонд: ${(amount * 2 * 0.95).toFixed(2)} USDT\n` +
    `⚔️ Игра: Монетка (Орел или Решка)\n\n` +
    `⏱ Вызов действителен 5 минут`;
}

function createDuelKeyboard(challengerId, targetUsername, amount) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '⚔️ Принять вызов', 
        `accept_duel_${challengerId}_${amount}`
      ),
      Markup.button.callback(
        '❌ Отклонить', 
        `decline_duel_${challengerId}`
      )
    ]
  ]);
}

function getDuelDescription(targetUsername) {
  return targetUsername 
    ? `Вызвать @${targetUsername}` 
    : 'Открытый вызов';
}

module.exports = {
  registerInlineHandlers
};