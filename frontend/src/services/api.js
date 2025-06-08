// frontend/src/services/api.js
import axios from 'axios';

// Принудительно устанавливаем правильный API URL для продакшена
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Логируем только в development режиме
if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_ENABLE_LOGS !== 'false') {

}

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

    // Добавляем данные Telegram WebApp, если доступны
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;

      // Если есть initData, добавляем его в заголовки
      if (webApp.initData) {
        config.headers['telegram-data'] = webApp.initData;

      } else {

        // Если нет initData, но есть user, создаем базовую строку для development
        if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
          const userData = webApp.initDataUnsafe.user;

          // Создаем упрощенную строку initData для development
          const simpleInitData = `user=${encodeURIComponent(JSON.stringify(userData))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=dev_hash`;
          config.headers['telegram-data'] = simpleInitData;

        }
      }
    } else {

      // Fallback для разработки вне Telegram
      if (process.env.NODE_ENV === 'development') {
        const testUser = {
          id: 123456789,
          first_name: 'Тестовый',
          last_name: 'Пользователь',
          username: 'test_user'
        };

        const simpleInitData = `user=${encodeURIComponent(JSON.stringify(testUser))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=dev_hash`;
        config.headers['telegram-data'] = simpleInitData;

      }
    }

    return config;
  },
  (error) => {

    return Promise.reject(error);
  }
);

// Добавляем интерцептор для ответов
api.interceptors.response.use(
  (response) => {

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

            // Логируем открытые ячейки
            if (response.data.data.clickedCells) {

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

    } else if (error.request) {
      // Запрос был сделан, но ответ не получен

      console.error('- Таймаут соединения (текущий таймаут: 30с)');

    } else {
      // Ошибка до выполнения запроса

    }

    return Promise.reject(error);
  }
);

// API для пользователей
const userApi = {
  // Авторизация через Telegram
  authWithTelegram: (telegramUser, referralCode = null) => {

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

    return api.post('/games/coin/play', { 
      betAmount, 
      selectedSide
    });
  },

  // Игра "Слоты"
  playSlots: (betAmount) => {

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

      throw error;
    }
  },

  // Игра "Мины" - ОБНОВЛЕННАЯ ВЕРСИЯ
  playMines: (betAmount, minesCount, clientSeed = null) => {

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

    return api.post('/payments/deposits', depositData);
  },

  // Получение истории депозитов
  getUserDeposits: (params = {}) => {

    return api.get('/payments/deposits', { params });
  },

  // Проверка статуса депозита
  checkDepositStatus: (depositId) => {

    return api.get(`/payments/deposits/${depositId}/status`);
  },

  // Получение информации о депозите
  getDepositInfo: (depositId) => {

    return api.get(`/payments/deposits/${depositId}`);
  },

  // === МЕТОДЫ ДЛЯ ВЫВОДОВ ===

  // Создание запроса на вывод
  createWithdrawal: (withdrawalData) => {

    return api.post('/withdrawals', withdrawalData);
  },

  // Получение истории выводов
  getUserWithdrawals: (params = {}) => {

    return api.get('/withdrawals', { params });
  },

  // Проверка статуса вывода
  checkWithdrawalStatus: (withdrawalId) => {

    return api.get(`/withdrawals/${withdrawalId}/status`);
  },

  // Получение информации о выводе
  getWithdrawalInfo: (withdrawalId) => {

    return api.get(`/withdrawals/${withdrawalId}`);
  },

  // Отмена запроса на вывод
  cancelWithdrawal: (withdrawalId) => {

    return api.delete(`/withdrawals/${withdrawalId}`);
  }
};

// API для событий
const eventsApi = {
  // Получить событие для главной страницы
  getFeaturedEvent: () => {

    return api.get('/events/featured');
  },

  // Получить активные события
  getActiveEvents: (limit = 4) => {

    return api.get('/events/active', { 
      params: { limit } 
    });
  },

  // Получить событие по ID
  getEventById: (eventId) => {

    return api.get(`/events/${eventId}`);
  },

  // Разместить ставку на событие
  placeBet: (eventId, outcomeId, betAmount) => {

    return api.post(`/events/${eventId}/bet`, {
      outcomeId,
      betAmount
    });
  },

  // Получить ставки пользователя
  getUserBets: (params = {}) => {

    return api.get('/events/user/bets', { params });
  },

  // Получить статистику событий
  getEventsStatistics: () => {

    return api.get('/events/stats/general');
  },

  // === АДМИНСКИЕ МЕТОДЫ ===

  // Создать событие (админ)
  createEvent: (eventData) => {
    console.log('Создание события (админ):', eventData);
    return api.post('/events/admin/create', eventData);
  },

  // Завершить событие (админ)
  finishEvent: (eventId, winningOutcomeId) => {
    console.log('Завершение события (админ):', { eventId, winningOutcomeId });
    return api.put(`/events/admin/${eventId}/finish`, { winningOutcomeId });
  },

  // Получить все события (админ)
  getAllEvents: (params = {}) => {
    console.log('Получение всех событий (админ):', params);
    return api.get('/events/admin/all', { params });
  }
};

// API для рефералов
const referralApi = {
  // Получить статистику партнера
  getPartnerStats: (period = null) => {

    return api.get('/referrals/stats', { params: { period } });
  },

  // Создать выплату реферальных средств
  createPayout: (amount) => {

    return api.post('/referrals/payout', { amount });
  },

  // Получить историю начислений
  getEarningsHistory: (params = {}) => {

    return api.get('/referrals/earnings', { params });
  },

  // Получить историю выплат
  getPayoutsHistory: (params = {}) => {

    return api.get('/referrals/payouts', { params });
  },

  // Получить список рефералов
  getReferrals: (params = {}) => {

    return api.get('/referrals/list', { params });
  }
};

// API для дуэлей
const duelApi = {
  // Получить активные дуэли пользователя
  getActiveDuels: () => {

    return api.get('/duels/user/active');
  },

  // Получить историю дуэлей пользователя
  getDuelHistory: (params = {}) => {

    return api.get('/duels/user/history', { params });
  },

  // Получить статистику дуэлей пользователя
  getDuelStats: () => {

    return api.get('/duels/user/stats');
  },

  // Получить информацию о дуэли
  getDuelInfo: (sessionId) => {

    return api.get(`/duels/${sessionId}`);
  },

  // Создать дуэль (пока недоступно в WebApp)
  createDuel: (duelData) => {
    console.log('Создание дуэли (WebApp):', duelData);
    return api.post('/duels', duelData);
  },

  // Принять дуэль
  acceptDuel: (sessionId) => {

    return api.post(`/duels/${sessionId}/accept`);
  },

  // Отклонить дуэль
  declineDuel: (sessionId) => {

    return api.post(`/duels/${sessionId}/decline`);
  },

  // Отменить дуэль
  cancelDuel: (sessionId) => {

    return api.post(`/duels/${sessionId}/cancel`);
  },

  // Получить открытые дуэли (для просмотра)
  getOpenDuels: () => {

    return api.get('/duels/public/open');
  }
};

// API для промокодов
const promocodeApi = {
  // Активировать промокод
  activatePromoCode: async (code) => {

    try {
      const response = await api.post('/promocodes/activate', { code });
      return response.data;
    } catch (error) {

      throw error;
    }
  },

  // Валидировать промокод (без активации)
  validatePromoCode: async (code) => {

    try {
      const response = await api.get(`/promocodes/${code}/validate`);
      return response.data;
    } catch (error) {

      throw error;
    }
  },

  // Получить промокоды пользователя
  getUserPromoCodes: async () => {

    try {
      const response = await api.get('/promocodes/user');
      return response.data;
    } catch (error) {

      throw error;
    }
  },

  // Получить доступные промокоды (публичные)
  getAvailablePromoCodes: async (type = null) => {

    try {
      const params = type ? { type } : {};
      const response = await api.get('/promocodes/available', { params });
      return response.data;
    } catch (error) {

      throw error;
    }
  }
};

// Экспортируем методы промокодов для удобства
export const { 
  activatePromoCode, 
  validatePromoCode, 
  getUserPromoCodes, 
  getAvailablePromoCodes 
} = promocodeApi;

export {
  api as default,
  userApi,
  gameApi,
  paymentApi,
  eventsApi,
  referralApi,
  duelApi,
  promocodeApi
};
