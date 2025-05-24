// ===== 4. backend/src/server.js =====

// server.js
require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

// Получение порта из переменных окружения
const PORT = process.env.PORT || 3001;

// Создание HTTP-сервера
const server = http.createServer(app);

// Настройка Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// WebSocket обработчики для игр в реальном времени
io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`);
  
  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Пользователь отключился: ${socket.id}`);
  });
  
  // Здесь будут обработчики для игр в реальном времени
});

// Функция инициализации CryptoBot после запуска сервера
async function initializeCryptoBot() {
  try {
    console.log('🤖 Инициализация CryptoBot...');
    
    // Импортируем сервис настройки CryptoBot
    const cryptoBotSetup = require('./services/cryptobot-setup.service');
    
    // Запускаем полную настройку
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
      
      // Показываем информацию об окружении
      console.log(`🔧 Режим: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.CRYPTO_PAY_API_TOKEN) {
        console.log('🔑 CryptoBot API token: настроен');
        
        // Инициализируем CryptoBot через небольшую задержку
        setTimeout(() => {
          initializeCryptoBot();
        }, 3000); // 3 секунды задержки для стабилизации сервера
        
      } else {
        console.log('⚠️ CryptoBot API token: НЕ НАСТРОЕН');
        console.log('   Добавьте CRYPTO_PAY_API_TOKEN в переменные окружения');
      }
      
      // Показываем доступные endpoints
      console.log('\n📋 Доступные endpoints:');
      console.log('   GET  / - Главная страница API');
      console.log('   GET  /api/health - Проверка работоспособности');
      console.log('   POST /api/users/auth - Аутентификация пользователя');
      console.log('   POST /api/payments/deposits - Создание депозита');
      console.log('   POST /webhooks/cryptobot - Webhook от CryptoBot');
      console.log('   GET  /webhooks/health - Статус webhook системы');
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