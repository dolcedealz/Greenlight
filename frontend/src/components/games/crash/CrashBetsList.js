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
    if (!username) return 'Аноним';
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
    const hash = userId?.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };
  
  const displayBets = getDisplayBets();
  
  return (
    <div className="crash-bets-list">
      <div className="bets-header">
        <div className="bets-tabs">
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Ставки ({activeBets.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'cashed' ? 'active' : ''}`}
            onClick={() => setActiveTab('cashed')}
          >
            Выведено ({cashedOutBets.length})
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
                        {bet.cashOutMultiplier.toFixed(2)}x
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
          <span className="stat-value">{activeBets.length + cashedOutBets.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Общая сумма:</span>
          <span className="stat-value">
            {(activeBets.reduce((sum, bet) => sum + bet.amount, 0) + 
              cashedOutBets.reduce((sum, bet) => sum + bet.amount, 0)).toFixed(2)} USDT
          </span>
        </div>
      </div>
    </div>
  );
};

export default CrashBetsList;