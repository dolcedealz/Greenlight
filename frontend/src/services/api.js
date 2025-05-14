// api.js - окончательно исправленная версия с поддержкой игры "Мины"
import axios from 'axios';

// Используем фиксированный URL для API с префиксом /api
const API_BASE_URL = 'https://greenlight-api-ghqh.onrender.com/api';
console.log('API URL:', API_BASE_URL);

// Создаем экземпляр axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // Увеличиваем таймаут до 30 секунд
});

// Добавляем интерцептор для запросов
api.interceptors.request.use(
  (config) => {
    console.log(`Отправка запроса на: ${config.baseURL}${config.url}`);
    
    // Добавляем данные Telegram WebApp, если доступны
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      
      // Если есть initData, добавляем его в заголовки
      if (webApp.initData) {
        config.headers['Telegram-Data'] = webApp.initData;
        console.log('Данные Telegram добавлены в заголовки');
      } else {
        console.warn('Данные Telegram WebApp.initData отсутствуют');
        
        // Если нет initData, но есть user, создаем базовый объект для тестирования
        if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
          const userData = webApp.initDataUnsafe.user;
          config.headers['X-Telegram-User'] = JSON.stringify(userData);
          console.log('Добавлены тестовые данные пользователя Telegram:', userData);
        }
      }
    } else {
      console.warn('Telegram WebApp не обнаружен');
    }
    
    return config;
  },
  (error) => {
    console.error('Ошибка в интерцепторе запросов:', error);
    return Promise.reject(error);
  }
);

// Добавляем интерцептор для ответов
api.interceptors.response.use(
  (response) => {
    console.log(`Успешный ответ от: ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    // Детальное логирование ошибки для отладки
    if (error.response) {
      // Ошибка с ответом от сервера
      console.error(`Ошибка API ${error.response.status}:`, error.response.data);
      console.error('URL запроса:', error.config.url);
      console.error('Метод запроса:', error.config.method);
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      console.error('Нет ответа от API. Возможные причины:');
      console.error('- API-сервер недоступен или перегружен');
      console.error('- Проблемы с сетевым соединением');
      console.error('- Таймаут соединения (текущий таймаут: 30с)');
      console.error('URL запроса:', error.config.url);
      console.error('Метод запроса:', error.config.method);
    } else {
      // Ошибка до выполнения запроса
      console.error('Ошибка запроса API:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// API для пользователей
const userApi = {
  // Авторизация через Telegram
  authWithTelegram: (telegramUser, referralCode = null) => {
    console.log('Аутентификация пользователя:', telegramUser);
    
    return api.post('/users/auth', { 
      user: telegramUser, 
      referralCode 
    });
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
    console.log('Игра "Монетка":', { betAmount, selectedSide, clientSeed });
    
    return api.post('/games/coin/play', { 
      betAmount, 
      selectedSide, 
      clientSeed 
    });
  },
  
  // Игра "Мины"
  // frontend/src/services/api.js
// Игра "Мины"
playMines: (betAmount, minesCount, clientSeed = null) => {
  console.log('Игра "Мины":', { betAmount, minesCount, clientSeed });
  
  return api.post('/games/mines/play', {
    betAmount,
    minesCount,
    clientSeed
  });
},

// Завершение игры в мины (клик по ячейке или кешаут)
completeMinesGame: (gameId, row, col, cashout) => {
  console.log('Завершение игры "Мины":', { gameId, row, col, cashout });
  
  // Создаем объект с параметрами запроса
  const requestData = { gameId, cashout };
  
  // Добавляем координаты только для клика по ячейке
  if (!cashout && row !== null && col !== null) {
    requestData.row = row;
    requestData.col = col;
  }
  
  return api.post('/games/mines/complete', requestData);
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