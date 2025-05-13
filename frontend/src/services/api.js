// api.js
import axios from 'axios';

// Получаем базовый URL из переменных окружения или используем localhost для разработки
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Добавляем интерцептор для добавления данных Telegram инициализации
api.interceptors.request.use(
  (config) => {
    // Если в window есть объект Telegram и initData
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      config.headers['Telegram-Data'] = window.Telegram.WebApp.initData;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// API для пользователей
const userApi = {
  // Авторизация через Telegram
  authWithTelegram: (telegramUser, referralCode = null) => {
    return api.post('/users/auth', { user: telegramUser, referralCode });
  },
  
  // Получение профиля пользователя
  getUserProfile: () => {
    return api.get('/users/profile');
  },
  
  // Получение баланса пользователя
  getBalance: () => {
    return api.get('/users/balance');
  },
  
  // Получение истории транзакций
  getTransactions: (params = {}) => {
    return api.get('/users/transactions', { params });
  }
};

// API для игр
const gameApi = {
  // Игра "Монетка"
  playCoinFlip: (betAmount, selectedSide, clientSeed = null) => {
    return api.post('/games/coin/play', { betAmount, selectedSide, clientSeed });
  },
  
  // Получение истории игр
  getGameHistory: (params = {}) => {
    return api.get('/games/history', { params });
  },
  
  // Получение статистики игр
  getGameStats: () => {
    return api.get('/games/stats');
  }
};

export {
  api as default,
  userApi,
  gameApi
};