// frontend/src/services/api.js
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
    
    // Специальная обработка для игры "Мины"
    if (response.config.url.includes('/games/mines/')) {
      console.log('ОТЛАДКА МИНЫ - Ответ сервера:', JSON.stringify(response.data, null, 2));
      
      // Проверка на наличие множителя в ответе
      if (response.data && response.data.data) {
        if (response.data.data.currentMultiplier) {
          console.log('МНОЖИТЕЛЬ ПОЛУЧЕН:', response.data.data.currentMultiplier);
        } else {
          console.warn('ВНИМАНИЕ: Множитель не найден в ответе сервера!');
        }
        
        // Проверка на странные значения
        if (response.data.data.win === true && response.data.data.profit < 0) {
          console.error('ОШИБКА В ДАННЫХ: Выигрыш (win=true) с отрицательной прибылью!', response.data.data.profit);
        }
      }
    }
    
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
  
  // Игра "Мины" - ОБНОВЛЕННАЯ ВЕРСИЯ
  playMines: (betAmount, minesCount, clientSeed = null) => {
    console.log('Запуск игры "Мины":', { betAmount, minesCount, clientSeed });
    
    // Создаем уникальный seed если не предоставлен
    const finalClientSeed = clientSeed || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return api.post('/games/mines/play', {
      betAmount,
      minesCount,
      clientSeed: finalClientSeed
    }).then(response => {
      console.log('ОТЛАДКА МИНЫ - Ответ на начало игры:', JSON.stringify(response.data, null, 2));
      
      // Проверка валидности ответа
      if (!response.data?.data?.gameId) {
        console.error('ОШИБКА: API не вернул ID игры');
      }
      
      return response;
    });
  },

  // Завершение игры в мины - ОБНОВЛЕННАЯ ВЕРСИЯ
  completeMinesGame: (gameId, row, col, cashout) => {
    // Логируем действие для отладки
    const actionType = cashout ? 'кешаут' : `клик по ячейке [${row},${col}]`;
    console.log(`Действие в игре "Мины": ${actionType}, gameId=${gameId}`);
    
    // Создаем объект с параметрами запроса
    const requestData = { gameId, cashout };
    
    // Добавляем координаты только для клика по ячейке
    if (!cashout && row !== null && col !== null) {
      requestData.row = row;
      requestData.col = col;
    }
    
    console.log('ОТЛАДКА МИНЫ - Отправка данных:', JSON.stringify(requestData, null, 2));
    
    return api.post('/games/mines/complete', requestData)
      .then(response => {
        console.log('ОТЛАДКА МИНЫ - Ответ на действие:', JSON.stringify(response.data, null, 2));
        
        // Проверка данных ответа
        if (response.data?.data) {
          // Проверка множителя для продолжающейся игры
          if (!cashout && response.data.data.win === null) {
            if (response.data.data.currentMultiplier) {
              // Получаем открытые ячейки для расчета ожидаемого множителя
              const clickedCells = response.data.data.clickedCells || [];
              const revealedCount = clickedCells.length;
              
              // Примерно оцениваем количество мин (если не знаем точно)
              const safeTotal = 25 - (requestData.minesCount || 5);
              const remainingSafe = safeTotal - revealedCount;
              
              // Расчетный множитель
              const expectedMultiplier = remainingSafe > 0 ? 
                (safeTotal / remainingSafe) * 0.95 : 
                safeTotal * 0.95;
              
              console.log('ОТЛАДКА МНОЖИТЕЛЯ:');
              console.log(`- Множитель от сервера: ${response.data.data.currentMultiplier}`);
              console.log(`- Ожидаемый множитель: ${expectedMultiplier.toFixed(4)}`);
              console.log(`- Формула: (${safeTotal}/${remainingSafe})*0.95`);
              
              // Проверка соответствия с погрешностью
              if (Math.abs(response.data.data.currentMultiplier - expectedMultiplier) > 0.01) {
                console.warn('ПРЕДУПРЕЖДЕНИЕ: Множитель от сервера не соответствует ожидаемому');
              }
            } else {
              console.warn('ВНИМАНИЕ: Множитель отсутствует в ответе сервера!');
            }
          }
          
          // Проверка корректности данных при кешауте
          if (cashout && response.data.data.win === true) {
            if (response.data.data.profit <= 0) {
              console.error('ОШИБКА: Выигрыш имеет отрицательное значение при win=true!');
            }
          }
        }
        
        return response;
      });
  },
  
  // Получение истории игр
  getGameHistory: (params = {}) => {
    return api.get('/games/history', { params });
  },
  
  // Получение статистики игр
  getGameStats: () => {
    return api.get('/games/stats');
  },
  
  // Тестовый эндпоинт для проверки множителя
  testMinesMultiplier: (minesCount, revealed) => {
    return api.get('/games/debug/mines/multiplier', { 
      params: { minesCount, revealed } 
    });
  }
};

export {
  api as default,
  userApi,
  gameApi
};