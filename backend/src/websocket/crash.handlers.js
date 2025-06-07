// backend/src/websocket/crash.handlers.js
const crashService = require('../services/crash.service');

class CrashWebSocketHandlers {
  constructor(io) {
    this.io = io;
    this.setupEventListeners();
    console.log('🚀 CRASH WEBSOCKET: Обработчики инициализированы');
  }

  setupEventListeners() {
    // Слушаем события от crash service и транслируем их клиентам
    crashService.on('roundCreated', (data) => {
      // Отправляем в правильную комнату с правильным названием события
      this.io.to('game_crash').emit('crash_new_round', {
        ...data,
        status: 'waiting'
      });
    });

    crashService.on('countdownUpdate', (data) => {
      this.io.to('game_crash').emit('crash_countdown_update', data);
    });

    crashService.on('gameStarted', (data) => {
      this.io.to('game_crash').emit('crash_game_started', data);
    });

    crashService.on('multiplierUpdate', (data) => {
      this.io.to('game_crash').emit('crash_multiplier_update', data);
    });

    crashService.on('gameCrashed', (data) => {
      console.log(`🔍 WEBSOCKET CRASH: Отправка crash_game_crashed события:`, {
        roundId: data.roundId,
        crashPoint: data.crashPoint,
        finalMultiplier: data.finalMultiplier
      });
      this.io.to('game_crash').emit('crash_game_crashed', data);
    });

    crashService.on('betPlaced', (data) => {
      this.io.to('game_crash').emit('crash_bet_placed', data);
    });

    crashService.on('autoCashOut', (data) => {
      this.io.to('game_crash').emit('crash_auto_cash_out', data);
    });

    crashService.on('manualCashOut', (data) => {
      this.io.to('game_crash').emit('crash_manual_cash_out', data);
    });

    crashService.on('roundCompleted', (data) => {
      this.io.to('game_crash').emit('crash_round_completed', data);
    });

    // Настраиваем обработчики подключений
    this.io.on('connection', (socket) => {
      this.setupSocketHandlers(socket);
    });
  }

  setupSocketHandlers(socket) {
    // Подключение к краш игре
    socket.on('join_crash', async () => {
      // Проверяем аутентификацию для участия в игре
      if (!socket.userId && !socket.isGuest) {
        socket.emit('crash_error', {
          message: 'Для участия в игре требуется авторизация'
        });
        return;
      }
      
      socket.join('game_crash');
      console.log(`CRASH WEBSOCKET: Пользователь ${socket.telegramId || socket.id} подключился к краш игре`);
      
      // Отправляем текущее состояние игры
      const gameState = await crashService.getCurrentGameState();
      socket.emit('crash_game_state', gameState);
    });

    // Отключение от краш игры
    socket.on('leave_crash', () => {
      socket.leave('game_crash');
      console.log(`CRASH WEBSOCKET: Пользователь ${socket.id} отключился от краш игры`);
    });

    // Запрос текущего состояния игры
    socket.on('get_crash_state', async () => {
      const gameState = await crashService.getCurrentGameState();
      socket.emit('crash_game_state', gameState);
    });
  }
}

module.exports = CrashWebSocketHandlers;