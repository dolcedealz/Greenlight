// backend/src/server.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const app = require('./app');
const setupWebSocket = require('./websocket');

// Получение порта из переменных окружения
const PORT = process.env.PORT || 3001;

// Создание HTTP-сервера
const server = http.createServer(app);

// Настройка WebSocket
const io = setupWebSocket(server);

// Функция инициализации CryptoBot после запуска сервера
async function initializeCryptoBot() {
  try {
    console.log('🤖 Инициализация CryptoBot...');
    
    const cryptoBotSetup = require('./services/cryptobot-setup.service');
    const setupResult = await cryptoBotSetup.fullSetup();
    
    if (setupResult) {
      console.log('✅ CryptoBot успешно настроен');
    } else {
      console.log('⚠️ Проблемы с настройкой CryptoBot (проверьте логи выше)');
    }
    
  } catch (error) {
    console.error('❌ Ошибка инициализации CryptoBot:', error);
  }
}

// Функция инициализации Crash игры
async function initializeCrashGame() {
  try {
    console.log('🚀 Инициализация Crash игры...');
    
    // Краш сервис инициализируется автоматически при импорте
    // Просто проверяем, что он загружен
    const { crashService } = require('./services');
    
    console.log('✅ Crash игра успешно инициализирована');
    
  } catch (error) {
    console.error('❌ Ошибка инициализации Crash игры:', error);
  }
}

// Функция инициализации очистки просроченных дуэлей
async function initializeDuelCleanup() {
  try {
    console.log('🧹 Инициализация очистки дуэлей...');
    
    const { duelService } = require('./services');
    
    // Запускаем очистку каждые 5 минут
    setInterval(async () => {
      try {
        const result = await duelService.cleanupExpiredData();
        if (result.expiredDuels > 0 || result.expiredInvitations > 0) {
          console.log(`🧹 Очищено: ${result.expiredDuels} просроченных дуэлей, ${result.expiredInvitations} приглашений`);
        }
      } catch (error) {
        console.error('❌ Ошибка очистки дуэлей:', error);
      }
    }, 5 * 60 * 1000); // 5 минут
    
    // Также запускаем очистку сразу
    const initialResult = await duelService.cleanupExpiredData();
    console.log(`✅ Дуэль очистка инициализирована. Очищено: ${initialResult.expiredDuels} дуэлей, ${initialResult.expiredInvitations} приглашений`);
    
  } catch (error) {
    console.error('❌ Ошибка инициализации очистки дуэлей:', error);
  }
}

// Подключение к MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Подключено к MongoDB');
    
    // Запуск сервера
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🌐 API доступен по адресу: http://localhost:${PORT}`);
      console.log(`📡 Webhook URL: http://localhost:${PORT}/webhooks/cryptobot`);
      console.log(`🎮 WebSocket сервер готов`);
      
      // Показываем информацию об окружении
      console.log(`🔧 Режим: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.CRYPTO_PAY_API_TOKEN) {
        console.log('🔑 CryptoBot API token: настроен');
        
        // Инициализируем CryptoBot через небольшую задержку
        setTimeout(() => {
          initializeCryptoBot();
        }, 3000);
        
      } else {
        console.log('⚠️ CryptoBot API token: НЕ НАСТРОЕН');
        console.log('   Добавьте CRYPTO_PAY_API_TOKEN в переменные окружения');
      }
      
      // Инициализируем Crash игру через задержку
      setTimeout(() => {
        initializeCrashGame();
      }, 5000); // 5 секунд задержки для стабилизации всех систем
      
      // Инициализируем очистку дуэлей
      setTimeout(() => {
        initializeDuelCleanup();
      }, 7000); // 7 секунд задержки
      
      // Показываем доступные endpoints
      console.log('\n📋 Доступные endpoints:');
      console.log('   GET  / - Главная страница API');
      console.log('   GET  /api/health - Проверка работоспособности');
      console.log('   POST /api/users/auth - Аутентификация пользователя');
      console.log('   POST /api/games/crash/bet - Размещение ставки в краш');
      console.log('   POST /api/games/crash/cashout - Вывод ставки в краш');
      console.log('   GET  /api/games/crash/state - Состояние краш игры');
      console.log('   GET  /api/games/crash/history - История краш игры');
      console.log('   POST /api/payments/deposits - Создание депозита');
      console.log('   POST /webhooks/cryptobot - Webhook от CryptoBot');
    });
  })
  .catch((error) => {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  });

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('💥 Необработанное исключение:', error);
  console.error('Stack trace:', error.stack);
});

// Обработка необработанных отклонений промисов
process.on('unhandledRejection', (error) => {
  console.error('💥 Необработанное отклонение промиса:', error);
  console.error('Stack trace:', error.stack);
});

// Корректное завершение при сигналах
process.on('SIGTERM', () => {
  console.log('🛑 Получен SIGTERM. Закрытие сервера...');
  
  // Останавливаем Crash игру
  try {
    const { crashService } = require('./services');
    crashService.stop();
    console.log('🔒 Crash игра остановлена');
  } catch (error) {
    console.error('Ошибка остановки Crash игры:', error);
  }
  
  server.close(() => {
    console.log('🔒 HTTP сервер закрыт');
    
    mongoose.connection.close(false, () => {
      console.log('🔒 Соединение с MongoDB закрыто');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Получен SIGINT (Ctrl+C). Закрытие сервера...');
  
  // Останавливаем Crash игру
  try {
    const { crashService } = require('./services');
    crashService.stop();
    console.log('🔒 Crash игра остановлена');
  } catch (error) {
    console.error('Ошибка остановки Crash игры:', error);
  }
  
  server.close(() => {
    console.log('🔒 HTTP сервер закрыт');
    
    mongoose.connection.close(false, () => {
      console.log('🔒 Соединение с MongoDB закрыто');
      process.exit(0);
    });
  });
});

// Экспортируем сервер и io для использования в других модулях
module.exports = { server, io };