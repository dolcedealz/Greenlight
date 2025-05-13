// index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config');
const commands = require('./commands');
const handlers = require('./handlers');
const middleware = require('./middleware');

// Инициализация бота
const bot = new Telegraf(config.botToken);

// Устанавливаем команды бота
bot.telegram.setMyCommands(config.commands)
  .then(() => console.log('Команды бота успешно установлены'))
  .catch(error => console.error('Ошибка при установке команд бота:', error));

// Применяем middleware
middleware.applyMiddleware(bot);

// Регистрируем команды
commands.registerCommands(bot);

// Регистрируем обработчики
handlers.registerHandlers(bot);

// Обработка ошибок
bot.catch((error, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, error);
});

// Запускаем бота
if (process.env.NODE_ENV === 'production') {
  // Для production используем webhook
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  const PORT = process.env.PORT || 3000;
  
  bot.telegram.setWebhook(WEBHOOK_URL)
    .then(() => console.log('Webhook установлен на', WEBHOOK_URL))
    .catch(error => console.error('Ошибка при установке webhook:', error));
  
  // Настраиваем обработку webhook
  bot.startWebhook('/', null, PORT);
  
  console.log(`Бот запущен в режиме webhook на порту ${PORT}`);
} else {
  // Для разработки используем long polling
  bot.launch()
    .then(() => console.log('Бот запущен в режиме long polling'))
    .catch(error => console.error('Ошибка при запуске бота:', error));
}

// Корректное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));