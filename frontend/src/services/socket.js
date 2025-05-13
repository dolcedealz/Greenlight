// socket.js
import { io } from 'socket.io-client';

// Получаем базовый URL для сокетов из переменных окружения
const SOCKET_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

// Создаем экземпляр сокета
const socket = io(SOCKET_URL, {
  autoConnect: false, // Не подключаться автоматически
  transports: ['websocket']
});

// Управление сокетом
const socketService = {
  // Подключение к сокету
  connect: () => {
    if (!socket.connected) {
      socket.connect();
    }
  },
  
  // Отключение от сокета
  disconnect: () => {
    if (socket.connected) {
      socket.disconnect();
    }
  },
  
  // Подписка на события
  subscribe: (event, callback) => {
    socket.on(event, callback);
  },
  
  // Отписка от событий
  unsubscribe: (event, callback) => {
    socket.off(event, callback);
  },
  
  // Отправка события
  emit: (event, data) => {
    socket.emit(event, data);
  }
};

export default socketService;