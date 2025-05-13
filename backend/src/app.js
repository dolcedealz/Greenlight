// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { errorMiddleware } = require('./middleware');

const app = express();

// Настройка middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Простое логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Подключение маршрутов API
app.use('/api', routes);

// Базовый маршрут
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Greenlight Casino API',
    version: '1.0.0',
    status: 'online'
  });
});

// Обработка несуществующих маршрутов
app.use((req, res, next) => {
  const error = new Error('Маршрут не найден');
  error.statusCode = 404;
  next(error);
});

// Middleware для обработки ошибок
app.use(errorMiddleware);

module.exports = app;