// inline.handler.js
const config = require('../config');

/**
 * Регистрация обработчиков inline query (без дуэлей)
 */
function registerInlineHandlers(bot) {
  console.log('🔍 Регистрация inline обработчиков (без дуэлей)...');
  
  bot.on('inline_query', async (ctx) => {
    try {
      const query = ctx.inlineQuery.query.trim();
      const results = [];
      
      console.log(`📥 Inline query получен: {
  query: '${query}',
  user: '${ctx.from.username}',
  userId: '${ctx.from.id}'
}`);
      
      // Если запрос не связан с дуэлями, показываем справку
      if (query && !query.startsWith('duel')) {
        results.push({
          type: 'article',
          id: 'inline_help',
          title: '❓ Справка по inline командам',
          description: 'Доступные команды',
          input_message_content: {
            message_text: `🤖 **Справка по inline командам**\n\n` +
                         `**Дуэли:**\n` +
                         `\`@bot duel @username сумма игра формат\`\n` +
                         `Пример: \`@bot duel @player 100 🎲 bo3\`\n\n` +
                         `**Доступные игры:**\n` +
                         `🎲 Кости • 🎯 Дартс • ⚽ Футбол\n` +
                         `🏀 Баскетбол • 🎳 Боулинг • 🎰 Слоты`,
            parse_mode: 'Markdown'
          }
        });
      }
      
      // Если запрос пустой или не найдено результатов
      if (results.length === 0) {
        results.push({
          type: 'article',
          id: 'default_help',
          title: '🎮 Greenlight Bot',
          description: 'Введите команду для использования',
          input_message_content: {
            message_text: `🎮 **Greenlight Bot**\n\n` +
                         `Введите команду для использования inline режима.\n\n` +
                         `Например: \`duel @username 100 🎲 bo3\``,
            parse_mode: 'Markdown'
          }
        });
      }
      
      console.log(`📤 Отправляем inline результаты: {
  resultsCount: ${results.length}
}`);
      
      await ctx.answerInlineQuery(results, {
        cache_time: 5,
        is_personal: true
      });
      
    } catch (error) {
      console.error('Ошибка обработки inline query:', error);
      await ctx.answerInlineQuery([]);
    }
  });
  
  console.log('✅ Inline обработчики зарегистрированы');
}

module.exports = {
  registerInlineHandlers
};