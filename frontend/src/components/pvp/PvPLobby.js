// frontend/src/components/pvp/PvPLobby.js
import React, { useState, useEffect } from 'react';
import { useWebApp } from '../../hooks';
import api from '../../services/api';
import '../../styles/PvPLobby.css';

const PvPLobby = ({ sessionId, userData, onGameStart, onError }) => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const webApp = useWebApp();

  // Загрузка данных сессии
  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);
        console.log('PvP: Загрузка сессии', sessionId);
        
        const response = await api.get(`/pvp/session/${sessionId}`);
        if (response.data.success) {
          setSessionData(response.data.data);
          setIsJoined(response.data.data.isPlayer && 
            (response.data.data.challengerJoined || response.data.data.opponentJoined));
          setIsReady(response.data.data.isPlayer && 
            (response.data.data.challengerReady || response.data.data.opponentReady));
        } else {
          onError('Сессия не найдена');
        }
      } catch (error) {
        console.error('PvP: Ошибка загрузки сессии:', error);
        onError(error.response?.data?.message || 'Ошибка загрузки сессии');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadSession();
    }
  }, [sessionId, onError]);

  // Присоединение к сессии
  const handleJoinSession = async () => {
    try {
      console.log('PvP: Присоединение к сессии');
      
      const response = await api.post(`/pvp/join/${sessionId}`);
      if (response.data.success) {
        setSessionData(prev => ({ ...prev, ...response.data.data }));
        setIsJoined(true);
        webApp?.showAlert('Добро пожаловать в игровую комнату!');
      }
    } catch (error) {
      console.error('PvP: Ошибка присоединения:', error);
      onError(error.response?.data?.message || 'Ошибка присоединения к сессии');
    }
  };

  // Установка готовности
  const handleSetReady = async (ready) => {
    try {
      console.log('PvP: Установка готовности:', ready);
      
      const response = await api.post(`/pvp/ready/${sessionId}`, { ready });
      if (response.data.success) {
        setSessionData(prev => ({ ...prev, ...response.data.data }));
        setIsReady(ready);
        
        if (ready) {
          webApp?.showAlert('Вы готовы к игре!');
        }
      }
    } catch (error) {
      console.error('PvP: Ошибка установки готовности:', error);
      onError(error.response?.data?.message || 'Ошибка установки готовности');
    }
  };

  // Запуск игры
  const handleStartGame = async () => {
    try {
      console.log('PvP: Запуск игры');
      
      const response = await api.post(`/pvp/start/${sessionId}`);
      if (response.data.success) {
        console.log('PvP: Игра запущена, результат:', response.data.data);
        onGameStart(response.data.data);
      }
    } catch (error) {
      console.error('PvP: Ошибка запуска игры:', error);
      onError(error.response?.data?.message || 'Ошибка запуска игры');
    }
  };

  // Автоматический запуск игры когда оба готовы
  useEffect(() => {
    if (sessionData && sessionData.bothJoined && sessionData.bothReady && sessionData.status === 'accepted') {
      console.log('PvP: Оба игрока готовы, автозапуск игры');
      handleStartGame();
    }
  }, [sessionData]);

  if (loading) {
    return (
      <div className="pvp-lobby loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Загрузка игровой комнаты...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="pvp-lobby error">
        <h2>❌ Сессия не найдена</h2>
        <p>Возможно, сессия истекла или была отменена</p>
      </div>
    );
  }

  if (sessionData.status === 'completed') {
    return (
      <div className="pvp-lobby completed">
        <h2>🏆 Игра завершена</h2>
        <div className="game-result">
          <p>Победитель: <strong>@{sessionData.winnerUsername}</strong></p>
          <p>Результат: <strong>{sessionData.coinResult === 'heads' ? 'Орел' : 'Решка'}</strong></p>
          <p>Выигрыш: <strong>{sessionData.winAmount} USDT</strong></p>
        </div>
      </div>
    );
  }

  const isChallenger = sessionData.isChallenger;
  const playerData = isChallenger ? {
    username: sessionData.challengerUsername,
    joined: sessionData.challengerJoined,
    ready: sessionData.challengerReady,
    side: sessionData.challengerSide
  } : {
    username: sessionData.opponentUsername,
    joined: sessionData.opponentJoined,
    ready: sessionData.opponentReady,
    side: sessionData.opponentSide
  };

  const opponentData = isChallenger ? {
    username: sessionData.opponentUsername,
    joined: sessionData.opponentJoined,
    ready: sessionData.opponentReady,
    side: sessionData.opponentSide
  } : {
    username: sessionData.challengerUsername,
    joined: sessionData.challengerJoined,
    ready: sessionData.challengerReady,
    side: sessionData.challengerSide
  };

  return (
    <div className="pvp-lobby">
      <div className="lobby-header">
        <h1>🎯 Дуэль Монеток</h1>
        <div className="session-info">
          <p>Сессия: <code>{sessionId}</code></p>
          <div className="prize-pool">
            <span className="amount">{sessionData.winAmount} USDT</span>
            <span className="label">Банк</span>
          </div>
        </div>
      </div>

      <div className="players-grid">
        {/* Ваш игрок */}
        <div className={`player-card your-player ${playerData.ready ? 'ready' : ''}`}>
          <div className="player-header">
            <h3>🤺 Вы</h3>
            <span className="username">@{playerData.username}</span>
          </div>
          
          <div className="player-side">
            <div className="coin-side">
              <span className="coin-emoji">{playerData.side === 'heads' ? '🪙' : '🥈'}</span>
              <span className="side-name">{playerData.side === 'heads' ? 'ОРЕЛ' : 'РЕШКА'}</span>
            </div>
          </div>

          <div className="player-status">
            {!isJoined ? (
              <button 
                className="join-button"
                onClick={handleJoinSession}
                disabled={loading}
              >
                🚪 Войти в комнату
              </button>
            ) : !isReady ? (
              <button 
                className="ready-button"
                onClick={() => handleSetReady(true)}
                disabled={loading}
              >
                ✅ Готов к игре
              </button>
            ) : (
              <div className="status-indicator ready">
                <span>✅ Готов</span>
              </div>
            )}
          </div>

          <div className="player-info">
            <div className="info-item">
              <span className="label">Ставка:</span>
              <span className="value">{sessionData.amount} USDT</span>
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="vs-section">
          <div className="vs-circle">
            <span>VS</span>
          </div>
          <div className="coin-preview">
            <div className="coin-animation">
              🪙
            </div>
          </div>
        </div>

        {/* Оппонент */}
        <div className={`player-card opponent-player ${opponentData.ready ? 'ready' : ''}`}>
          <div className="player-header">
            <h3>⚔️ Соперник</h3>
            <span className="username">@{opponentData.username}</span>
          </div>
          
          <div className="player-side">
            <div className="coin-side">
              <span className="coin-emoji">{opponentData.side === 'heads' ? '🪙' : '🥈'}</span>
              <span className="side-name">{opponentData.side === 'heads' ? 'ОРЕЛ' : 'РЕШКА'}</span>
            </div>
          </div>

          <div className="player-status">
            {!opponentData.joined ? (
              <div className="status-indicator waiting">
                <span>⏳ Ожидает присоединения</span>
              </div>
            ) : !opponentData.ready ? (
              <div className="status-indicator waiting">
                <span>⏳ Подготавливается</span>
              </div>
            ) : (
              <div className="status-indicator ready">
                <span>✅ Готов</span>
              </div>
            )}
          </div>

          <div className="player-info">
            <div className="info-item">
              <span className="label">Ставка:</span>
              <span className="value">{sessionData.amount} USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Статус игры */}
      <div className="game-status">
        {!sessionData.bothJoined ? (
          <div className="status-message waiting">
            <p>⏳ Ожидание игроков...</p>
            <p>Оба игрока должны войти в комнату</p>
          </div>
        ) : !sessionData.bothReady ? (
          <div className="status-message preparing">
            <p>🎮 Подготовка к игре...</p>
            <p>Игроки подтверждают готовность</p>
          </div>
        ) : (
          <div className="status-message ready">
            <p>🚀 Все готово!</p>
            <p>Игра начнется автоматически...</p>
          </div>
        )}
      </div>

      {/* Правила */}
      <div className="game-rules">
        <h4>📋 Правила игры:</h4>
        <ul>
          <li>🪙 Инициатор играет за <strong>ОРЕЛ</strong>, оппонент за <strong>РЕШКА</strong></li>
          <li>🎲 Результат определяется справедливым алгоритмом</li>
          <li>🏆 Победитель получает <strong>{sessionData.winAmount} USDT</strong></li>
          <li>💰 Комиссия составляет <strong>5%</strong> от общего банка</li>
        </ul>
      </div>
    </div>
  );
};

export default PvPLobby;