// index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { commands, middleware, handlers } = require('./src');

// Инициализация бота с токеном из переменных окружения
const bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);

// Список ID администраторов
const adminIds = process.env.ADMIN_IDS 
  ? process.env.ADMIN_IDS.split(',').map(id => Number(id.trim()))
  : [];

console.log('Admin IDs:', adminIds);

// Применяем middleware
middleware.applyMiddleware(bot, adminIds);

// Регистрируем команды
commands.registerCommands(bot);

// Регистрируем обработчики сообщений и callback
handlers.registerHandlers(bot);

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.')
    .catch(e => console.error('Ошибка при отправке сообщения об ошибке:', e));
});

// Запуск бота
if (process.env.NODE_ENV === 'production') {
  // Для продакшена используем webhook
  const PORT = process.env.PORT || 3000;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  
  if (WEBHOOK_URL) {
    bot.telegram.setWebhook(WEBHOOK_URL)
      .then(() => console.log('Webhook установлен:', WEBHOOK_URL))
      .catch(err => console.error('Ошибка установки webhook:', err));
    
    bot.startWebhook('/', null, PORT);
    console.log(`Админ-бот запущен в режиме webhook на порту ${PORT}`);
  } else {
    bot.launch()
      .then(() => console.log('Админ-бот запущен в режиме polling'))
      .catch(err => console.error('Ошибка запуска бота:', err));
  }
} else {
  // Для разработки используем long polling
  bot.launch()
    .then(() => console.log('Админ-бот запущен в режиме polling'))
    .catch(err => console.error('Ошибка запуска бота:', err));
}

// Правильное завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));