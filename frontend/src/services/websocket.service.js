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
    
    // URL для WebSocket соединения
    this.socketUrl = process.env.REACT_APP_WS_URL || 'https://greenlight-api-ghqh.onrender.com';
    
    console.log('WebSocketService инициализирован, URL:', this.socketUrl);
  }

  /**
   * Подключение к WebSocket серверу
   * @param {string} userTelegramId - ID пользователя Telegram
   */
  async connect(userTelegramId = null) {
    try {
      if (this.socket && this.socket.connected) {
        console.log('WebSocket уже подключен');
        return true;
      }

      console.log('🔌 Подключение к WebSocket серверу...');

      // Создаем новое соединение
      this.socket = io(this.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        query: {
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
          console.log('✅ WebSocket подключен успешно');
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ Ошибка подключения к WebSocket:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ Ошибка создания WebSocket соединения:', error);
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
      console.log('🔌 WebSocket подключен, ID:', this.socket.id);
    });

    // Соединение разорвано
    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('🔌 WebSocket отключен, причина:', reason);
      
      // Автоматическое переподключение
      if (reason === 'io server disconnect') {
        // Сервер принудительно отключил - не переподключаемся
        return;
      }
      
      this.attemptReconnect();
    });

    // Ошибка соединения
    this.socket.on('connect_error', (error) => {
      console.error('🔌 Ошибка WebSocket соединения:', error);
      this.isConnected = false;
      this.attemptReconnect();
    });

    // Pong ответ на ping
    this.socket.on('pong', (data) => {
      console.log('🏓 Pong получен:', data);
    });

    // Общая ошибка
    this.socket.on('error', (error) => {
      console.error('🔌 WebSocket ошибка:', error);
    });
  }

  /**
   * Попытка переподключения
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🔌 Превышено максимальное количество попыток переподключения');
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
      console.log('🔌 Отключение от WebSocket...');
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
      console.warn('🎮 Нельзя присоединиться к Crash - WebSocket не подключен');
      return false;
    }

    console.log('🎮 Присоединение к Crash игре...');
    this.socket.emit('join_game', 'crash');
    return true;
  }

  /**
   * Покинуть Crash игру
   */
  leaveCrash() {
    if (!this.socket || !this.isConnected) {
      console.warn('🎮 Нельзя покинуть Crash - WebSocket не подключен');
      return false;
    }

    console.log('🎮 Покидание Crash игры...');
    this.socket.emit('leave_game', 'crash');
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
      console.warn(`🔌 Нельзя подписаться на событие ${event} - WebSocket не создан`);
      return () => {};
    }

    console.log(`📡 Подписка на событие: ${event}`);
    
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
      console.log(`📡 Отписка от события: ${event}`);
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
    
    console.log(`📡 Отписка от события: ${event}`);
  }

  /**
   * Отправка события
   * @param {string} event - Название события
   * @param {any} data - Данные для отправки
   */
  emit(event, data = null) {
    if (!this.socket || !this.isConnected) {
      console.warn(`🔌 Нельзя отправить событие ${event} - WebSocket не подключен`);
      return false;
    }

    console.log(`📤 Отправка события: ${event}`, data);
    this.socket.emit(event, data);
    return true;
  }

  /**
   * Ping сервера для проверки соединения
   */
  ping() {
    if (!this.socket || !this.isConnected) {
      console.warn('🏓 Нельзя отправить ping - WebSocket не подключен');
      return false;
    }

    console.log('🏓 Отправка ping...');
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
    console.log('📡 Все подписки удалены');
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