// frontend/src/components/games/crash/CrashBetsList.js
import React, { useState } from 'react';
import '../../../styles/CrashBetsList.css';

const CrashBetsList = ({ activeBets, cashedOutBets, gameState }) => {
  const [activeTab, setActiveTab] = useState('active'); // active, cashed
  
  // Получаем отображаемые ставки
  const getDisplayBets = () => {
    if (activeTab === 'active') {
      return activeBets.slice(0, 50); // Показываем максимум 50 активных ставок
    } else {
      return cashedOutBets.slice(0, 50); // Показываем максимум 50 выведенных ставок
    }
  };
  
  // Форматирование имени пользователя
  const formatUsername = (username) => {
    if (!username) return 'Игрок';
    if (username.length > 8) {
      return username.slice(0, 6) + '...';
    }
    return username;
  };
  
  // Генерация цвета для пользователя
  const getUserColor = (userId) => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', 
      '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe',
      '#fd79a8', '#e84393', '#00b894', '#00cec9'
    ];
    
    if (!userId) return colors[0];
    
    const hash = userId.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  // Генерация тестовых ставок для демонстрации
  const generateMockBets = () => {
    if (activeBets.length === 0 && cashedOutBets.length === 0) {
      return {
        active: [
          {
            id: 1,
            amount: 15.50,
            autoCashOut: 1.8,
            username: 'SpeedPlayer',
            userId: 'user1',
            isCurrentUser: false
          },
          {
            id: 2,
            amount: 32.00,
            autoCashOut: 0,
            username: 'QuickCash',
            userId: 'user2',
            isCurrentUser: false
          },
          {
            id: 3,
            amount: 8.25,
            autoCashOut: 1.3,
            username: 'FastWin',
            userId: 'user3',
            isCurrentUser: false
          },
          {
            id: 4,
            amount: 22.75,
            autoCashOut: 2.5,
            username: 'RocketMan',
            userId: 'user4',
            isCurrentUser: false
          }
        ],
        cashed: [
          {
            id: 5,
            amount: 18.00,
            autoCashOut: 2.1,
            username: 'SmartPlayer',
            userId: 'user5',
            isCurrentUser: false,
            cashOutMultiplier: 1.9,
            winAmount: 34.20
          },
          {
            id: 6,
            amount: 12.50,
            autoCashOut: 0,
            username: 'LuckyOne',
            userId: 'user6',
            isCurrentUser: false,
            cashOutMultiplier: 3.4,
            winAmount: 42.50
          },
          {
            id: 7,
            amount: 7.25,
            autoCashOut: 1.5,
            username: 'FastCash',
            userId: 'user7',
            isCurrentUser: false,
            cashOutMultiplier: 1.5,
            winAmount: 10.88
          }
        ]
      };
    }
    
    return {
      active: activeBets,
      cashed: cashedOutBets
    };
  };
  
  const mockData = generateMockBets();
  const displayBets = activeTab === 'active' ? mockData.active : mockData.cashed;
  
  return (
    <div className="crash-bets-list">
      <div className="bets-header">
        <div className="bets-tabs">
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Ставки ({mockData.active.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'cashed' ? 'active' : ''}`}
            onClick={() => setActiveTab('cashed')}
          >
            💰 Выведено ({mockData.cashed.length})
          </button>
        </div>
      </div>
      
      <div className="bets-content">
        {displayBets.length === 0 ? (
          <div className="no-bets">
            <span className="no-bets-icon">📊</span>
            <span className="no-bets-text">
              {activeTab === 'active' ? 'Нет активных ставок' : 'Нет выведенных ставок'}
            </span>
          </div>
        ) : (
          <div className="bets-list">
            {displayBets.map((bet, index) => (
              <div 
                key={bet.id || index} 
                className={`bet-item ${bet.isCurrentUser ? 'current-user' : ''}`}
              >
                <div className="bet-user">
                  <div 
                    className="user-avatar"
                    style={{ backgroundColor: getUserColor(bet.userId) }}
                  >
                    {formatUsername(bet.username).charAt(0).toUpperCase()}
                  </div>
                  <span className="username">
                    {formatUsername(bet.username)}
                    {bet.isCurrentUser && <span className="you-label">(Вы)</span>}
                  </span>
                </div>
                
                <div className="bet-details">
                  <div className="bet-amount">
                    {bet.amount.toFixed(2)} USDT
                  </div>
                  
                  {activeTab === 'active' && (
                    <div className="bet-auto">
                      {bet.autoCashOut > 0 ? (
                        <span className="auto-cashout">@{bet.autoCashOut}x</span>
                      ) : (
                        <span className="manual">Ручной</span>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'cashed' && bet.cashOutMultiplier && (
                    <div className="cashout-info">
                      <div className="cashout-multiplier">
                        🚀 {bet.cashOutMultiplier.toFixed(2)}x
                      </div>
                      <div className="win-amount">
                        +{bet.winAmount.toFixed(2)} USDT
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Статистика */}
      <div className="bets-stats">
        <div className="stat-item">
          <span className="stat-label">Всего ставок:</span>
          <span className="stat-value">{mockData.active.length + mockData.cashed.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">💰 Общая сумма:</span>
          <span className="stat-value">
            {(mockData.active.reduce((sum, bet) => sum + bet.amount, 0) + 
              mockData.cashed.reduce((sum, bet) => sum + bet.amount, 0)).toFixed(2)} USDT
          </span>
        </div>
      </div>
      
      {/* Информация о состоянии игры */}
      <div className="game-status">
        <div className="status-indicator">
          <span className="status-dot" data-state={gameState}></span>
          <span className="status-text">
            {gameState === 'waiting' && '⏳ Прием ставок (7 сек)'} {/* ИЗМЕНЕНО: с 1 сек на 7 сек */}
            {gameState === 'flying' && '🚀 Полет'}
            {gameState === 'crashed' && '💥 Краш (новый через 0.3 сек)'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CrashBetsList;
