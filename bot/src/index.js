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


// Обработчик вебхуков от CryptoBot
app.post('/webhook/cryptobot', express.json(), async (req, res) => {
  try {
    console.log('Получено уведомление от CryptoBot:', req.body);
    
    // Проверка подписи запроса для безопасности
    const { payment } = req.body;
    if (!payment) {
      return res.status(400).send('Invalid payload');
    }
    
    // Обрабатываем платеж
    await handleCryptoBotPayment(payment);
    
    // Отвечаем CryptoBot, что все ок
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке вебхука CryptoBot:', error);
    res.status(500).send('Internal Server Error');
  }
});

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

// Маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.send('<h1>Greenlight Bot</h1><p>Бот активен и работает в режиме webhook</p>');
});

// Получаем порт и домен из переменных окружения
const PORT = process.env.PORT || 3000;
const WEBHOOK_DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_DOMAIN;

/**
 * Настраивает вебхук для уведомлений от CryptoBot
 */
async function setupCryptoBotWebhook() {
  try {
    const { token, apiUrl } = config.cryptoBot;
    const webhookUrl = `${process.env.WEBHOOK_DOMAIN}/webhook/cryptobot`;
    
    // Отправляем запрос к API CryptoBot для настройки вебхука
    const response = await axios.post(
      `${apiUrl}/setWebhook`,
      {
        url: webhookUrl
      },
      {
        headers: {
          'Crypto-Pay-API-Token': token,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.ok) {
      console.log(`✅ Вебхук CryptoBot успешно настроен: ${webhookUrl}`);
    } else {
      console.error('❌ Ошибка при настройке вебхука CryptoBot:', response.data);
    }
  } catch (error) {
    console.error('❌ Ошибка при настройке вебхука CryptoBot:', error);
  }
}

// Вызываем настройку вебхука при запуске сервера
if (WEBHOOK_DOMAIN) {
  setupCryptoBotWebhook();
}

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