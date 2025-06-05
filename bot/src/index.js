// index.js с webhook для Render
require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const config = require('./config');
const commands = require('./commands');
const handlers = require('./handlers');
const middleware = require('./middleware');

// Создаем Express приложение
const app = express();

// Настройка для обработки JSON
app.use(express.json());

// Инициализация бота
const bot = new Telegraf(config.botToken);

// Получаем информацию о боте
bot.telegram.getMe()
  .then((botInfo) => {
    bot.botInfo = botInfo;
    console.log(`Бот инициализирован: @${botInfo.username}`);
  })
  .catch(error => console.error('Ошибка получения информации о боте:', error));

// Устанавливаем команды бота
bot.telegram.setMyCommands(config.commands)
  .then(() => console.log('Команды бота успешно установлены'))
  .catch(error => console.error('Ошибка при установке команд бота:', error));

// ВАЖНО: Порядок применения middleware и обработчиков критичен!

// 1. Сначала применяем middleware (включая сессии)
middleware.applyMiddleware(bot);

// 2. Затем регистрируем команды
commands.registerCommands(bot);

// 3. Затем регистрируем callback handlers
const { registerCallbackHandlers } = require('./handlers/callback.handler');
registerCallbackHandlers(bot);

// 4. Затем регистрируем inline handlers
const { registerInlineHandlers } = require('./handlers/inline.handler');
registerInlineHandlers(bot);

// 5. Регистрируем новые обработчики дуэлей (заменяет emoji-duel.handler)
const { registerDuelHandlers } = require('./handlers/duel.handler');
registerDuelHandlers(bot);

// 6. И в самом конце - обработчики текстовых сообщений
const { registerMessageHandlers } = require('./handlers/message.handler');
registerMessageHandlers(bot);

// Обработка ошибок
bot.catch((error, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, error);
  console.error('Контекст ошибки:', {
    updateType: ctx.updateType,
    message: ctx.message,
    from: ctx.from,
    session: ctx.session
  });
});

// Маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.send('<h1>Greenlight Bot</h1><p>Бот активен и работает в режиме webhook</p>');
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
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    
    try {
      // Сначала удаляем любые существующие webhook или polling соединения
      await bot.telegram.deleteWebhook();
      
      console.log(`Настройка webhook URL: ${webhookUrl}`);
      
      // Устанавливаем webhook
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook успешно установлен: ${webhookUrl}`);
      
      // Проверяем информацию о боте
      try {
        const botInfo = await bot.telegram.getMe();
        console.log(`🤖 Информация о боте:`, {
          username: botInfo.username,
          name: botInfo.first_name,
          canJoinGroups: botInfo.can_join_groups,
          canReadAllGroupMessages: botInfo.can_read_all_group_messages,
          supportsInlineQueries: botInfo.supports_inline_queries
        });
        
        if (!botInfo.supports_inline_queries) {
          console.warn('⚠️  ВНИМАНИЕ: Inline mode не включен! Включите его через @BotFather -> /setinline');
        }
      } catch (infoError) {
        console.error('Ошибка получения информации о боте:', infoError);
      }
      
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
      .then(() => console.log('✅ Бот запущен в режиме polling'))
      .catch(err => console.error('❌ Ошибка запуска бота:', err));
  });
}

// Корректное завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
