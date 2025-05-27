// backend/src/websocket/crash.handlers.js
const crashService = require('../services/crash.service');

class CrashWebSocketHandlers {
  constructor(io) {
    this.io = io;
    this.setupEventListeners();
    console.log('🚀 CRASH WEBSOCKET: Обработчики инициализированы');
  }

  setupEventListeners() {
    // Слушаем события от crash service
    crashService.on('roundCreated', (data) => {
      this.io.to('crash').emit('round_created', data);
    });

    crashService.on('countdownUpdate', (data) => {
      this.io.to('crash').emit('countdown_update', data);
    });

    crashService.on('gameStarted', (data) => {
      this.io.to('crash').emit('game_started', data);
    });

    crashService.on('multiplierUpdate', (data) => {
      this.io.to('crash').emit('multiplier_update', data);
    });

    crashService.on('gameCrashed', (data) => {
      this.io.to('crash').emit('game_crashed', data);
    });

    crashService.on('betPlaced', (data) => {
      this.io.to('crash').emit('bet_placed', data);
    });

    crashService.on('autoCashOut', (data) => {
      this.io.to('crash').emit('auto_cash_out', data);
    });

    crashService.on('manualCashOut', (data) => {
      this.io.to('crash').emit('manual_cash_out', data);
    });

    crashService.on('roundCompleted', (data) => {
      this.io.to('crash').emit('round_completed', data);
    });

    // Настраиваем обработчики подключений
    this.io.on('connection', (socket) => {
      this.setupSocketHandlers(socket);
    });
  }

  setupSocketHandlers(socket) {
    // Подключение к краш игре
    socket.on('join_crash', () => {
      socket.join('crash');
      console.log(`CRASH WEBSOCKET: Пользователь ${socket.id} подключился к краш игре`);
      
      // Отправляем текущее состояние игры
      const gameState = crashService.getCurrentGameState();
      socket.emit('game_state', gameState);
    });

    // Отключение от краш игры
    socket.on('leave_crash', () => {
      socket.leave('crash');
      console.log(`CRASH WEBSOCKET: Пользователь ${socket.id} отключился от краш игры`);
    });

    // Запрос текущего состояния игры
    socket.on('get_game_state', () => {
      const gameState = crashService.getCurrentGameState();
      socket.emit('game_state', gameState);
    });

    // Обработка отключения
    socket.on('disconnect', () => {
      // Пользователь автоматически покинет все комнаты
    });
  }
}

module.exports = CrashWebSocketHandlers;
