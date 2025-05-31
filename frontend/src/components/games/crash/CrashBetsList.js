// frontend/src/components/games/crash/CrashBetsList.js
import React, { useState } from 'react';
import '../../../styles/CrashBetsList.css';

const CrashBetsList = ({ activeBets, cashedOutBets, gameState }) => {
  const [activeTab, setActiveTab] = useState('active'); // active, cashed
  
  // Получаем только реальные данные
  const getDisplayBets = () => {
    if (activeTab === 'active') {
      return (activeBets || []).slice(0, 50); // Показываем максимум 50 активных ставок
    } else {
      return (cashedOutBets || []).slice(0, 50); // Показываем максимум 50 выведенных ставок
    }
  };
  
  // Форматирование имени пользователя с маскированием
  const formatUsername = (username, isCurrentUser = false) => {
    if (!username) return 'Игрок';
    
    // Если это текущий пользователь, показываем полное имя
    if (isCurrentUser) {
      if (username.length > 8) {
        return username.slice(0, 6) + '...';
      }
      return username;
    }
    
    // Для других пользователей маскируем имя
    if (username.length <= 3) {
      return username.charAt(0) + '*'.repeat(username.length - 1);
    } else if (username.length <= 6) {
      return username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
    } else {
      return username.slice(0, 2) + '*'.repeat(3) + username.slice(-1);
    }
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
  
  // Только реальные данные
  const displayBets = getDisplayBets();
  const realActiveBets = activeBets || [];
  const realCashedBets = cashedOutBets || [];
  
  return (
    <div className="crash-bets-list">
      <div className="bets-header">
        <div className="bets-tabs">
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Ставки ({realActiveBets.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'cashed' ? 'active' : ''}`}
            onClick={() => setActiveTab('cashed')}
          >
            💰 Выведено ({realCashedBets.length})
          </button>
        </div>
      </div>
      
      <div className="bets-content">
        {displayBets.length === 0 ? (
          <div className="no-bets">
            <span className="no-bets-icon">📊</span>
            <span className="no-bets-text">
              {activeTab === 'active' 
                ? 'Пока нет ставок в этом раунде' 
                : 'Пока никто не вывел средства'}
            </span>
            <span className="no-bets-subtext">
              {activeTab === 'active' 
                ? 'Станьте первым, кто сделает ставку!' 
                : 'Выводы появятся здесь в реальном времени'}
            </span>
          </div>
        ) : (
          <div className="bets-list">
            {displayBets.map((bet, index) => (
              <div 
                key={bet.id || `${bet.userId}-${index}`} 
                className={`bet-item ${bet.isCurrentUser ? 'current-user' : ''}`}
              >
                <div className="bet-user">
                  <div 
                    className="user-avatar"
                    style={{ backgroundColor: getUserColor(bet.userId) }}
                  >
                    {formatUsername(bet.username, bet.isCurrentUser).charAt(0).toUpperCase()}
                  </div>
                  <span className="username">
                    {formatUsername(bet.username, bet.isCurrentUser)}
                    {bet.isCurrentUser && <span className="you-label">(Вы)</span>}
                  </span>
                </div>
                
                <div className="bet-details">
                  <div className="bet-amount">
                    {bet.amount ? bet.amount.toFixed(2) : '0.00'} USDT
                  </div>
                  
                  {activeTab === 'active' && (
                    <div className="bet-auto">
                      {bet.autoCashOut && bet.autoCashOut > 0 ? (
                        <span className="auto-cashout" title={`Автовывод при ${bet.autoCashOut.toFixed(2)}x`}>
                          🤖 {bet.autoCashOut.toFixed(2)}x
                        </span>
                      ) : (
                        <span className="manual" title="Ручной вывод">
                          ✋ Ручной
                        </span>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'cashed' && bet.cashOutMultiplier && (
                    <div className="cashout-info">
                      <div className="cashout-multiplier" title={`Вывел при множителе ${bet.cashOutMultiplier.toFixed(2)}x`}>
                        🚀 {bet.cashOutMultiplier.toFixed(2)}x
                      </div>
                      <div className="win-amount" title={`Выигрыш: ${bet.winAmount ? bet.winAmount.toFixed(2) : '0.00'} USDT`}>
                        💰 +{bet.winAmount ? bet.winAmount.toFixed(2) : '0.00'} USDT
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Статистика только для реальных данных */}
      {(realActiveBets.length > 0 || realCashedBets.length > 0) && (
        <div className="bets-stats">
          <div className="stat-item">
            <span className="stat-label">Всего ставок:</span>
            <span className="stat-value">{realActiveBets.length + realCashedBets.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">💰 Общая сумма:</span>
            <span className="stat-value">
              {(realActiveBets.reduce((sum, bet) => sum + (bet.amount || 0), 0) + 
                realCashedBets.reduce((sum, bet) => sum + (bet.amount || 0), 0)).toFixed(2)} USDT
            </span>
          </div>
          {realCashedBets.length > 0 && (
            <div className="stat-item">
              <span className="stat-label">🎉 Выведено:</span>
              <span className="stat-value">
                {realCashedBets.reduce((sum, bet) => sum + (bet.winAmount || 0), 0).toFixed(2)} USDT
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Информация о состоянии игры */}
      <div className="game-status">
        <div className="status-indicator">
          <span className="status-dot" data-state={gameState}></span>
          <span className="status-text">
            {gameState === 'waiting' && '⏳ Прием ставок'}
            {gameState === 'flying' && '🚀 Полет в процессе'}
            {gameState === 'crashed' && '💥 Раунд завершен'}
            {!gameState && '⚡ Загрузка игры...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CrashBetsList;