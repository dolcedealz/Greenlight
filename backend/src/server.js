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

// Подключение к MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Подключено к MongoDB');
    
    // Запуск сервера
    server.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  });

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
});

// Обработка необработанных отклонений промисов
process.on('unhandledRejection', (error) => {
  console.error('Необработанное отклонение промиса:', error);
});

// Корректное завершение при сигналах
process.on('SIGTERM', () => {
  console.log('Получен SIGTERM. Закрытие сервера...');
  server.close(() => {
    console.log('Сервер закрыт.');
    mongoose.connection.close(false, () => {
      console.log('Соединение с MongoDB закрыто.');
      process.exit(0);
    });
  });
});