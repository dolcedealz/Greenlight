// index.js - обновленная версия с HTTP-сервером для Render
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { commands, middleware, handlers } = require('./src');
const http = require('http');

// Проверяем наличие токена
if (!process.env.ADMIN_BOT_TOKEN) {
  console.error('❌ Ошибка: ADMIN_BOT_TOKEN не указан в переменных окружения');
  process.exit(1);
}

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

// Создаем простой HTTP-сервер для Render
// Это необходимо, чтобы Render определил открытый порт
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Greenlight Admin Bot</h1><p>Бот активен и работает в режиме polling</p>');
});

// Получаем порт из переменных окружения (важно для Render)
const PORT = process.env.PORT || 3000;

// Запускаем HTTP-сервер
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP-сервер запущен на порту ${PORT}`);
});

// Запуск бота в режиме long polling
bot.launch()
  .then(() => console.log('✅ Админ-бот запущен в режиме polling'))
  .catch(err => console.error('❌ Ошибка запуска бота:', err));

// Правильное завершение работы
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  server.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  server.close();
});