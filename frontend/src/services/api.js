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
      
      // Проверка для игры "Мины"
      if (response.data && response.data.data) {
        // При начале игры в Мины (только логирование, без ошибки)
        if (response.config.url.includes('/games/mines/play')) {
          console.log('ОТЛАДКА МИНЫ - Ответ на начало игры:', JSON.stringify(response.data, null, 2));
        }
        
        // При выполнении хода
        if (response.config.url.includes('/games/mines/complete')) {
          // Проверка множителя в ответе (без сравнения с формулой)
          if (response.data.data.currentMultiplier) {
            console.log('МНОЖИТЕЛЬ ПОЛУЧЕН:', response.data.data.currentMultiplier);
            
            // Логируем открытые ячейки
            if (response.data.data.clickedCells) {
              console.log('Открытые ячейки:', response.data.data.clickedCells.length);
            }
          }
          
          console.log('ОТЛАДКА МИНЫ - Ответ на действие:', JSON.stringify(response.data, null, 2));
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
  // Игра "Монетка" - ОБНОВЛЕННАЯ ВЕРСИЯ
  playCoinFlip: (betAmount, selectedSide) => {
    console.log('Игра "Монетка":', { betAmount, selectedSide });
    
    return api.post('/games/coin/play', { 
      betAmount, 
      selectedSide
    });
  },

  // Игра "Слоты"
playSlots: (betAmount) => {
  console.log('Игра "Слоты":', { betAmount });
  
  return api.post('/games/slots/play', { 
    betAmount
  });
},

  // === МЕТОДЫ ДЛЯ CRASH ИГРЫ ===
  
  /**
   * Разместить ставку в Crash
   * @param {number} amount - Сумма ставки
   * @param {number} autoCashOut - Автовывод (0 = отключен)
   * @returns {Promise<Object>}
   */
  placeCrashBet: async (amount, autoCashOut = 0) => {
    try {
      const response = await api.post('/games/crash/bet', {
        amount,
        autoCashOut
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка размещения ставки в Crash:', error);
      throw error;
    }
  },

  /**
   * Вывести ставку (кешаут) в Crash
   * В crash игре gameId не нужен - один пользователь может иметь только одну ставку в раунде
   * @returns {Promise<Object>}
   */
  cashOutCrash: async () => {
    try {
      const response = await api.post('/games/crash/cashout');
      return response.data;
    } catch (error) {
      console.error('Ошибка кешаута в Crash:', error);
      throw error;
    }
  },

  /**
   * Получить текущее состояние Crash игры
   * @returns {Promise<Object>}
   */
  getCrashState: async () => {
    try {
      const response = await api.get('/games/crash/state');
      return response.data;
    } catch (error) {
      console.error('Ошибка получения состояния Crash:', error);
      throw error;
    }
  },

  /**
   * Получить историю Crash игр
   * @param {number} limit - Количество записей
   * @returns {Promise<Object>}
   */
  getCrashHistory: async (limit = 20) => {
    try {
      const response = await api.get('/games/crash/history', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка получения истории Crash:', error);
      throw error;
    }
  },

  /**
   * Получить статистику пользователя в Crash
   * @returns {Promise<Object>}
   */
  getCrashStats: async () => {
    try {
      const response = await api.get('/games/crash/stats');
      return response.data;
    } catch (error) {
      console.error('Ошибка получения статистики Crash:', error);
      throw error;
    }
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
    
    return api.post('/games/mines/complete', requestData);
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

// API для платежей
const paymentApi = {
  // Создание депозита
  createDeposit: (depositData) => {
    console.log('Создание депозита:', depositData);
    
    return api.post('/payments/deposits', depositData);
  },
  
  // Получение истории депозитов
  getUserDeposits: (params = {}) => {
    console.log('Получение истории депозитов:', params);
    
    return api.get('/payments/deposits', { params });
  },
  
  // Проверка статуса депозита
  checkDepositStatus: (depositId) => {
    console.log('Проверка статуса депозита:', depositId);
    
    return api.get(`/payments/deposits/${depositId}/status`);
  },
  
  // Получение информации о депозите
  getDepositInfo: (depositId) => {
    console.log('Получение информации о депозите:', depositId);
    
    return api.get(`/payments/deposits/${depositId}`);
  },

  // === МЕТОДЫ ДЛЯ ВЫВОДОВ ===
  
  // Создание запроса на вывод
  createWithdrawal: (withdrawalData) => {
    console.log('Создание запроса на вывод:', withdrawalData);
    
    return api.post('/withdrawals', withdrawalData);
  },
  
  // Получение истории выводов
  getUserWithdrawals: (params = {}) => {
    console.log('Получение истории выводов:', params);
    
    return api.get('/withdrawals', { params });
  },
  
  // Проверка статуса вывода
  checkWithdrawalStatus: (withdrawalId) => {
    console.log('Проверка статуса вывода:', withdrawalId);
    
    return api.get(`/withdrawals/${withdrawalId}/status`);
  },
  
  // Получение информации о выводе
  getWithdrawalInfo: (withdrawalId) => {
    console.log('Получение информации о выводе:', withdrawalId);
    
    return api.get(`/withdrawals/${withdrawalId}`);
  },
  
  // Отмена запроса на вывод
  cancelWithdrawal: (withdrawalId) => {
    console.log('Отмена вывода:', withdrawalId);
    
    return api.delete(`/withdrawals/${withdrawalId}`);
  }
};

// PvP API методы
const pvpApi = {
  // Создать вызов на дуэль
  createChallenge: (challengeData) => {
    console.log('Создание PvP вызова:', challengeData);
    return api.post('/pvp/challenge', challengeData);
  },

  // Ответить на вызов
  respondToChallenge: (duelId, action) => {
    console.log(`Ответ на PvP вызов ${duelId}:`, action);
    return api.post(`/pvp/respond/${duelId}`, { action });
  },

  // Получить информацию о сессии
  getSession: (sessionId) => {
    console.log('Получение PvP сессии:', sessionId);
    return api.get(`/pvp/session/${sessionId}`);
  },

  // Присоединиться к сессии
  joinSession: (sessionId) => {
    console.log('Присоединение к PvP сессии:', sessionId);
    return api.post(`/pvp/join/${sessionId}`);
  },

  // Установить готовность
  setReady: (sessionId, ready = true) => {
    console.log(`Установка готовности PvP ${sessionId}:`, ready);
    return api.post(`/pvp/ready/${sessionId}`, { ready });
  },

  // Запустить игру
  startGame: (sessionId) => {
    console.log('Запуск PvP игры:', sessionId);
    return api.post(`/pvp/start/${sessionId}`);
  },

  // Получить активные дуэли
  getActiveDuels: () => {
    console.log('Получение активных PvP дуэлей');
    return api.get('/pvp/active');
  },

  // Получить историю PvP
  getHistory: (limit = 20) => {
    console.log('Получение истории PvP:', limit);
    return api.get(`/pvp/history?limit=${limit}`);
  },

  // Получить статистику PvP
  getStats: () => {
    console.log('Получение статистики PvP');
    return api.get('/pvp/stats');
  },

  // Создать реванш
  createRematch: (duelId) => {
    console.log('Создание реванша для дуэли:', duelId);
    return api.post(`/pvp/rematch/${duelId}`);
  },

  // Отменить вызов
  cancelChallenge: (duelId) => {
    console.log('Отмена PvP вызова:', duelId);
    return api.post(`/pvp/cancel/${duelId}`);
  },

  // Валидировать вызов
  validateChallenge: (opponentId, amount) => {
    console.log('Валидация PvP вызова:', { opponentId, amount });
    return api.post('/pvp/validate-challenge', { opponentId, amount });
  }
};

export {
  api as default,
  userApi,
  gameApi,
  paymentApi,
  pvpApi // Добавляем PvP API
};
