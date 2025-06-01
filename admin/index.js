// admin/index.js - ИСПРАВЛЕННАЯ ВЕРСИЯ с поддержкой сессий
require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { commands, middleware, handlers } = require('./src');
const express = require('express');

// Создаем Express приложение
const app = express();

// Настройка для обработки JSON
app.use(express.json());

// Проверяем наличие токена
if (!process.env.ADMIN_BOT_TOKEN) {
  console.error('❌ Ошибка: ADMIN_BOT_TOKEN не указан в переменных окружения');
  process.exit(1);
}

// Проверяем наличие API токена
if (!process.env.ADMIN_API_TOKEN) {
  console.error('❌ Ошибка: ADMIN_API_TOKEN не указан в переменных окружения');
  console.error('   Этот токен необходим для взаимодействия с API');
}

// Инициализация бота с токеном из переменных окружения
const bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);

// Список ID администраторов
const adminIds = process.env.ADMIN_IDS 
  ? process.env.ADMIN_IDS.split(',').map(id => Number(id.trim()))
  : [];

console.log('Admin IDs:', adminIds);
console.log('API URL:', process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api');
console.log('Admin API Token настроен:', !!process.env.ADMIN_API_TOKEN);

// ВАЖНО: Подключаем поддержку сессий ДО всех остальных middleware
bot.use(session({
  defaultSession: () => ({})
}));

// Применяем middleware для проверки админских прав
middleware.applyMiddleware(bot, adminIds);

// Регистрируем команды (включая команды для событий)
commands.registerCommands(bot);

// Регистрируем обработчики сообщений и callback
handlers.registerHandlers(bot);

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  console.error('Stack trace:', err.stack);
  
  // Попытаемся отправить сообщение об ошибке
  ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.')
    .catch(e => console.error('Ошибка при отправке сообщения об ошибке:', e));
});

// Маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.send(`
    <h1>Greenlight Admin Bot</h1>
    <p>Бот активен и работает в режиме webhook</p>
    <h2>Статус конфигурации:</h2>
    <ul>
      <li>ADMIN_BOT_TOKEN: ✅ Настроен</li>
      <li>ADMIN_API_TOKEN: ${process.env.ADMIN_API_TOKEN ? '✅ Настроен' : '❌ Не настроен'}</li>
      <li>API_URL: ${process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api'}</li>
      <li>Админы: ${adminIds.length > 0 ? adminIds.join(', ') : 'Не настроены'}</li>
    </ul>
  `);
});

// Получаем порт и домен из переменных окружения
const PORT = process.env.PORT || 3000;
const WEBHOOK_DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_DOMAIN;

// Запуск бота и настройка webhook
if (WEBHOOK_DOMAIN) {
  // Путь для webhook (добавляем токен для безопасности)
  const secretPath = `/webhook/${bot.secretPathComponent()}`;
  
  // Настройка маршрута для webhook
  app.use(bot.webhookCallback(secretPath));
  
  // Формирование полного URL для webhook
  const webhookUrl = `${WEBHOOK_DOMAIN}${secretPath}`;
  
  // Запуск сервера
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Админ-бот сервер запущен на порту ${PORT}`);
    
    try {
      // Сначала удаляем любые существующие webhook или polling соединения
      await bot.telegram.deleteWebhook();
      
      console.log(`Настройка webhook URL: ${webhookUrl}`);
      
      // Устанавливаем webhook
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook успешно установлен: ${webhookUrl}`);
      
      // Проверка webhook
      const webhookInfo = await bot.telegram.getWebhookInfo();
      console.log('Информация о webhook:', JSON.stringify(webhookInfo, null, 2));
      
      if (webhookInfo.url !== webhookUrl) {
        console.warn(`⚠️ Настроенный webhook URL (${webhookInfo.url}) не соответствует ожидаемому (${webhookUrl})`);
      }
      
      if (webhookInfo.last_error_date) {
        const errorTime = new Date(webhookInfo.last_error_date * 1000);
        console.warn(`⚠️ Последняя ошибка webhook: ${webhookInfo.last_error_message} (${errorTime})`);
      }
      
      console.log(`🔮 Функциональность событий: ${process.env.ADMIN_API_TOKEN ? '✅ Готова' : '❌ Требует ADMIN_API_TOKEN'}`);
      
    } catch (error) {
      console.error('❌ Ошибка при настройке webhook:', error);
    }
  });
} else {
  console.error('❌ Не указан WEBHOOK_DOMAIN или RENDER_EXTERNAL_URL в переменных окружения');
  console.log('🔄 Переключение на режим long polling (не рекомендуется в продакшене)');
  
  // Резервный вариант - long polling и HTTP-сервер
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ HTTP-сервер запущен на порту ${PORT}`);
    bot.launch()
      .then(() => {
        console.log('✅ Админ-бот запущен в режиме polling');
        console.log(`🔮 Функциональность событий: ${process.env.ADMIN_API_TOKEN ? '✅ Готова' : '❌ Требует ADMIN_API_TOKEN'}`);
      })
      .catch(err => console.error('❌ Ошибка запуска бота:', err));
  });
}

// Правильное завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
