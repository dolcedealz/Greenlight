// admin/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ с поддержкой расширенных функций и уведомлений
require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { commands, middleware, handlers } = require('./src');
let EventsNotificationService;
try {
  EventsNotificationService = require('./src/services/events-notifications.service');
  console.log('✅ EventsNotificationService импортирован успешно');
} catch (error) {
  console.error('❌ Ошибка импорта EventsNotificationService:', error.message);
  EventsNotificationService = null;
}
const eventsExtendedCommands = require('./src/commands/events-extended.command');
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
console.log('API URL:', process.env.API_URL || 'https://api.greenlight-casino.eu/api');
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

// Инициализируем сервис уведомлений о событиях
let notificationService;
if (EventsNotificationService && process.env.ADMIN_API_TOKEN && adminIds.length > 0) {
  try {
    notificationService = new EventsNotificationService(bot);
    console.log('✅ Сервис уведомлений о событиях инициализирован');
  } catch (error) {
    console.error('❌ Ошибка инициализации сервиса уведомлений:', error.message);
    notificationService = null;
  }
} else {
  console.warn('⚠️ Сервис уведомлений не инициализирован');
  if (!EventsNotificationService) console.warn('   - EventsNotificationService не найден');
  if (!process.env.ADMIN_API_TOKEN) console.warn('   - ADMIN_API_TOKEN не установлен');
  if (adminIds.length === 0) console.warn('   - Нет админов в ADMIN_IDS');
}

// === РЕГИСТРАЦИЯ НОВЫХ ОБРАБОТЧИКОВ ДЛЯ РАСШИРЕННЫХ ФУНКЦИЙ ===

// Обработчики для изменения времени события
bot.action('events_edit_time', async (ctx) => {
  console.log('ADMIN: Callback events_edit_time');
  await ctx.answerCbQuery();
  await eventsExtendedCommands.startTimeEdit(ctx);
});

bot.action(/^time_edit_(end|betting|both)$/, async (ctx) => {
  console.log('ADMIN: Callback time_edit_type:', ctx.match[1]);
  await eventsExtendedCommands.handleTimeTypeSelection(ctx, ctx.match[1]);
});

// Обработчики для досрочного завершения
bot.action('events_early_finish', async (ctx) => {
  console.log('ADMIN: Callback events_early_finish');
  await ctx.answerCbQuery();
  await eventsExtendedCommands.startEarlyFinish(ctx);
});

bot.action(/^early_finish_outcome_(.+)$/, async (ctx) => {
  console.log('ADMIN: Callback early_finish_outcome:', ctx.match[1]);
  const outcomeId = ctx.match[1];
  await eventsExtendedCommands.confirmEarlyFinish(ctx, outcomeId);
});

// Обработчики для установки исхода
bot.action('events_set_outcome', async (ctx) => {
  console.log('ADMIN: Callback events_set_outcome');
  await ctx.answerCbQuery();
  await eventsExtendedCommands.setEventOutcome(ctx);
});

bot.action(/^set_outcome_(.+)$/, async (ctx) => {
  console.log('ADMIN: Callback set_outcome:', ctx.match[1]);
  const outcomeId = ctx.match[1];
  await eventsExtendedCommands.saveSetOutcome(ctx, outcomeId);
});

// Обработчик для завершения подготовленного события
bot.action(/^finish_prepared_(.+)$/, async (ctx) => {
  console.log('ADMIN: Callback finish_prepared:', ctx.match[1]);
  const eventId = ctx.match[1];
  await eventsExtendedCommands.finishPreparedEvent(ctx, eventId);
});

// Обработчики для быстрых действий из уведомлений
bot.action(/^quick_(set_outcome|early_finish|edit_time)_(.+)$/, async (ctx) => {
  console.log('ADMIN: Quick action:', ctx.match[1], 'for event:', ctx.match[2]);
  if (notificationService) {
    await notificationService.handleQuickAction(ctx);
  } else {
    await ctx.answerCbQuery('❌ Сервис уведомлений недоступен');
  }
});

// Обновленное меню событий с расширенными функциями
bot.action('events_menu', async (ctx) => {
  console.log('ADMIN: Callback events_menu (extended)');
  await ctx.answerCbQuery();
  await eventsExtendedCommands.showExtendedEventsMenu(ctx);
});

// Команда для тестирования уведомлений
bot.command('test_notifications', async (ctx) => {
  if (notificationService) {
    await notificationService.sendTestNotification();
    await ctx.reply('✅ Тестовое уведомление отправлено');
  } else {
    await ctx.reply('❌ Сервис уведомлений недоступен');
  }
});

// Команда для получения статистики уведомлений
bot.command('notification_stats', async (ctx) => {
  if (notificationService) {
    const stats = notificationService.getNotificationStats();
    await ctx.reply(
      `📊 *Статистика уведомлений*\n\n` +
      `👥 Администраторов: ${stats.adminsCount}\n` +
      `🔔 Уведомленных событий: ${stats.notifiedEventsCount}\n` +
      `⏰ Последняя проверка: ${stats.lastCheck.toLocaleString('ru-RU')}\n` +
      `🟢 Статус: ${stats.isActive ? 'Активен' : 'Неактивен'}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Сервис уведомлений недоступен');
  }
});

// Обработка текстовых сообщений для новых функций
bot.on('text', async (ctx, next) => {
  console.log('ADMIN: Получено текстовое сообщение:', ctx.message.text);
  
  // Проверяем, если это процесс изменения времени
  if (ctx.session && ctx.session.editingTime) {
    console.log('ADMIN: Обрабатываем изменение времени события');
    await eventsExtendedCommands.handleTimeEdit(ctx);
    return;
  }
  
  // Проверяем, если это процесс досрочного завершения
  if (ctx.session && ctx.session.earlyFinishing) {
    console.log('ADMIN: Обрабатываем досрочное завершение события');
    await eventsExtendedCommands.handleEarlyFinish(ctx);
    return;
  }
  
  // Проверяем, если это процесс установки исхода
  if (ctx.session && ctx.session.settingOutcome) {
    console.log('ADMIN: Обрабатываем установку исхода события');
    await eventsExtendedCommands.handleSetOutcome(ctx);
    return;
  }
  
  // Передаем управление следующему обработчику
  return next();
});

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
  const notificationStats = notificationService ? notificationService.getNotificationStats() : null;
  
  res.send(`
    <h1>Greenlight Admin Bot</h1>
    <p>Бот активен и работает в режиме webhook</p>
    <h2>Статус конфигурации:</h2>
    <ul>
      <li>ADMIN_BOT_TOKEN: ✅ Настроен</li>
      <li>ADMIN_API_TOKEN: ${process.env.ADMIN_API_TOKEN ? '✅ Настроен' : '❌ Не настроен'}</li>
      <li>API_URL: ${process.env.API_URL || 'https://api.greenlight-casino.eu/api'}</li>
      <li>Админы: ${adminIds.length > 0 ? adminIds.join(', ') : 'Не настроены'}</li>
    </ul>
    <h2>Расширенные функции:</h2>
    <ul>
      <li>Изменение времени событий: ✅ Доступно</li>
      <li>Досрочное завершение: ✅ Доступно</li>
      <li>Установка исходов: ✅ Доступно</li>
      <li>Уведомления о событиях: ${notificationStats ? '✅ Активны' : '❌ Неактивны'}</li>
    </ul>
    ${notificationStats ? `
    <h2>Статистика уведомлений:</h2>
    <ul>
      <li>Администраторов: ${notificationStats.adminsCount}</li>
      <li>Уведомленных событий: ${notificationStats.notifiedEventsCount}</li>
      <li>Последняя проверка: ${notificationStats.lastCheck.toLocaleString('ru-RU')}</li>
    </ul>
    ` : ''}
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
      console.log(`🔔 Уведомления о событиях: ${notificationService ? '✅ Активны' : '❌ Неактивны'}`);
      console.log(`⚡ Расширенные функции: ✅ Загружены`);
      
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
        console.log(`🔔 Уведомления о событиях: ${notificationService ? '✅ Активны' : '❌ Неактивны'}`);
        console.log(`⚡ Расширенные функции: ✅ Загружены`);
      })
      .catch(err => console.error('❌ Ошибка запуска бота:', err));
  });
}

// Правильное завершение работы
process.once('SIGINT', () => {
  console.log('🛑 Получен SIGINT. Завершение работы...');
  if (notificationService) {
    console.log('🔔 Останавливаем сервис уведомлений');
  }
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 Получен SIGTERM. Завершение работы...');
  if (notificationService) {
    console.log('🔔 Останавливаем сервис уведомлений');
  }
  bot.stop('SIGTERM');
});
