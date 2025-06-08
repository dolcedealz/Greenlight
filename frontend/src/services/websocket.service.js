// frontend/src/services/websocket.service.js
import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventListeners = new Map();

    // Принудительно устанавливаем правильный WebSocket URL для продакшена
    this.socketUrl = process.env.REACT_APP_WS_URL || 'https://greenlight-api-ghqh.onrender.com';

  }

  /**
   * Подключение к WebSocket серверу для Telegram Mini App
   * @param {string} userTelegramId - ID пользователя Telegram
   */
  async connect(userTelegramId = null) {
    try {
      if (this.socket && this.socket.connected) {

        return true;
      }

      // Получаем Telegram WebApp данные если доступны
      let authData = {};

      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;

        // Используем initData для аутентификации
        if (tg.initData) {
          authData.initData = tg.initData;

        }

        // Fallback на telegramId если есть
        if (userTelegramId && !authData.initData) {
          authData.telegramId = userTelegramId;

        }
      } else if (userTelegramId) {
        // Если не в Telegram WebApp, используем переданный ID
        authData.telegramId = userTelegramId;

      }

      // Создаем новое соединение с аутентификацией
      this.socket = io(this.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        auth: authData,
        query: {
          source: 'telegram-mini-app',
          userTelegramId: userTelegramId || 'anonymous'
        }
      });

      // Настраиваем обработчики соединения
      this.setupConnectionHandlers();

      // Ждем подключения
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Таймаут подключения к WebSocket'));
        }, 10000);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;

          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);

          reject(error);
        });
      });

    } catch (error) {

      throw error;
    }
  }

  /**
   * Настройка обработчиков соединения
   */
  setupConnectionHandlers() {
    if (!this.socket) return;

    // Подключение установлено
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;

    });

    // Соединение разорвано
    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;

      // Автоматическое переподключение
      if (reason === 'io server disconnect') {
        // Сервер принудительно отключил - не переподключаемся
        return;
      }

      this.attemptReconnect();
    });

    // Ошибка соединения
    this.socket.on('connect_error', (error) => {

      this.isConnected = false;
      this.attemptReconnect();
    });

    // Pong ответ на ping
    this.socket.on('pong', (data) => {

    });

    // Общая ошибка
    this.socket.on('error', (error) => {

    });
  }

  /**
   * Попытка переподключения
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {

      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔌 Переподключение через ${delay}ms (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Отключение от WebSocket
   */
  disconnect() {
    if (this.socket) {

      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Присоединиться к Crash игре
   */
  joinCrash() {
    if (!this.socket || !this.isConnected) {

      return false;
    }

    // Отправляем специальное событие для краша
    this.socket.emit('join_crash');

    // Также присоединяемся к общей комнате игры
    this.socket.emit('join_game', 'crash');

    return true;
  }

  /**
   * Покинуть Crash игру
   */
  leaveCrash() {
    if (!this.socket || !this.isConnected) {

      return false;
    }

    // Отправляем специальное событие для краша
    this.socket.emit('leave_crash');

    // Также покидаем общую комнату игры
    this.socket.emit('leave_game', 'crash');

    return true;
  }

  /**
   * Запросить текущее состояние Crash игры
   */
  requestCrashState() {
    if (!this.socket || !this.isConnected) {

      return false;
    }

    this.socket.emit('get_crash_state');
    return true;
  }

  /**
   * Подписка на событие
   * @param {string} event - Название события
   * @param {function} callback - Функция обработчик
   * @returns {function} - Функция для отписки
   */
  on(event, callback) {
    if (!this.socket) {

      return () => {};
    }

    // Сохраняем колбэк для возможности отписки
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);

    // Подписываемся на событие
    this.socket.on(event, callback);

    // Возвращаем функцию для отписки
    return () => {
      if (this.socket) {
        this.socket.off(event, callback);
      }
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).delete(callback);
      }

    };
  }

  /**
   * Отписка от события
   * @param {string} event - Название события
   * @param {function} callback - Функция обработчик (опционально)
   */
  off(event, callback = null) {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).delete(callback);
      }
    } else {
      this.socket.off(event);
      this.eventListeners.delete(event);
    }

  }

  /**
   * Отправка события
   * @param {string} event - Название события
   * @param {any} data - Данные для отправки
   */
  emit(event, data = null) {
    if (!this.socket || !this.isConnected) {

      return false;
    }

    this.socket.emit(event, data);
    return true;
  }

  /**
   * Ping сервера для проверки соединения
   */
  ping() {
    if (!this.socket || !this.isConnected) {

      return false;
    }

    this.socket.emit('ping');
    return true;
  }

  /**
   * Получение статуса соединения
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts,
      url: this.socketUrl
    };
  }

  /**
   * Очистка всех подписок
   */
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
    this.eventListeners.clear();

  }

  /**
   * Проверка состояния соединения
   */
  isSocketConnected() {
    return this.socket && this.socket.connected && this.isConnected;
  }

  /**
   * Получение объекта сокета (для отладки)
   */
  getSocket() {
    return this.socket;
  }
}

// Создаем singleton экземпляр
const webSocketService = new WebSocketService();

export default webSocketService;