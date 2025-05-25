// frontend/src/components/games/crash/CrashHistory.js
import React from 'react';
import '../../../styles/CrashHistory.css';

const CrashHistory = ({ history }) => {
  
  // Получение цвета для множителя
  const getMultiplierColor = (multiplier) => {
    if (multiplier < 1.5) return '#ff3b30'; // Красный
    if (multiplier < 2) return '#ff9500'; // Оранжевый
    if (multiplier < 5) return '#ffcc00'; // Желтый
    if (multiplier < 10) return '#34c759'; // Зеленый
    return '#0ba84a'; // Темно-зеленый
  };
  
  // Получение класса для множителя
  const getMultiplierClass = (multiplier) => {
    if (multiplier < 1.5) return 'very-low';
    if (multiplier < 2) return 'low';
    if (multiplier < 5) return 'medium';
    if (multiplier < 10) return 'high';
    return 'very-high';
  };
  
  // Форматирование времени
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };
  
  // ОБНОВЛЕНО: Более разнообразные тестовые данные истории
  const getDisplayHistory = () => {
    if (history && history.length > 0) {
      return history;
    }
    
    // Улучшенные тестовые данные с разнообразными множителями
    return [
      {
        roundId: 1015,
        crashPoint: 2.34,
        timestamp: Date.now() - 3000,
        totalBets: 7,
        totalAmount: 145.2
      },
      {
        roundId: 1014,
        crashPoint: 1.08,
        timestamp: Date.now() - 13000,
        totalBets: 3,
        totalAmount: 67.5
      },
      {
        roundId: 1013,
        crashPoint: 8.91,
        timestamp: Date.now() - 23000,
        totalBets: 12,
        totalAmount: 289.7
      },
      {
        roundId: 1012,
        crashPoint: 1.67,
        timestamp: Date.now() - 33000,
        totalBets: 5,
        totalAmount: 98.3
      },
      {
        roundId: 1011,
        crashPoint: 4.56,
        timestamp: Date.now() - 43000,
        totalBets: 8,
        totalAmount: 176.4
      },
      {
        roundId: 1010,
        crashPoint: 1.23,
        timestamp: Date.now() - 53000,
        totalBets: 4,
        totalAmount: 55.8
      },
      {
        roundId: 1009,
        crashPoint: 12.78,
        timestamp: Date.now() - 63000,
        totalBets: 6,
        totalAmount: 134.9
      },
      {
        roundId: 1008,
        crashPoint: 1.85,
        timestamp: Date.now() - 73000,
        totalBets: 4,
        totalAmount: 89.5
      },
      {
        roundId: 1007,
        crashPoint: 3.42,
        timestamp: Date.now() - 83000,
        totalBets: 6,
        totalAmount: 156.3
      },
      {
        roundId: 1006,
        crashPoint: 1.12,
        timestamp: Date.now() - 93000,
        totalBets: 2,
        totalAmount: 25.0
      },
      {
        roundId: 1005,
        crashPoint: 7.89,
        timestamp: Date.now() - 103000,
        totalBets: 8,
        totalAmount: 203.7
      },
      {
        roundId: 1004,
        crashPoint: 2.45,
        timestamp: Date.now() - 113000,
        totalBets: 5,
        totalAmount: 127.5
      },
      {
        roundId: 1003,
        crashPoint: 1.23,
        timestamp: Date.now() - 123000,
        totalBets: 3,
        totalAmount: 45.2
      },
      {
        roundId: 1002,
        crashPoint: 15.67,
        timestamp: Date.now() - 133000,
        totalBets: 4,
        totalAmount: 67.8
      },
      {
        roundId: 1001,
        crashPoint: 4.21,
        timestamp: Date.now() - 143000,
        totalBets: 7,
        totalAmount: 189.4
      },
      {
        roundId: 1000,
        crashPoint: 1.05,
        timestamp: Date.now() - 153000,
        totalBets: 2,
        totalAmount: 18.5
      }
    ];
  };
  
  const displayHistory = getDisplayHistory();
  
  return (
    <div className="crash-history">
      <div className="history-header">
        <h3 className="history-title">📈 История</h3>
        {displayHistory.length > 0 && (
          <span className="history-count">{displayHistory.length} раундов</span>
        )}
      </div>
      
      <div className="history-content">
        {displayHistory.length === 0 ? (
          <div className="no-history">
            <span className="no-history-icon">📈</span>
            <span className="no-history-text">История раундов появится здесь</span>
          </div>
        ) : (
          <>
            {/* УЛУЧШЕННЫЙ: Компактный вид - последние 12 раундов в одной строке */}
            <div className="history-compact">
              <div className="compact-title">Последние раунды (множители):</div>
              <div className="compact-list">
                {displayHistory.slice(0, 12).map((round, index) => (
                  <div
                    key={round.roundId || index}
                    className={`compact-item ${getMultiplierClass(round.crashPoint)}`}
                    style={{ color: getMultiplierColor(round.crashPoint) }}
                    title={`Раунд ${round.roundId}: ${round.crashPoint.toFixed(2)}x в ${formatTime(round.timestamp)}`}
                  >
                    {round.crashPoint.toFixed(2)}x
                  </div>
                ))}
              </div>
            </div>
            
            {/* УЛУЧШЕННЫЙ: Детальный список с лучшей информацией */}
            <div className="history-detailed">
              {displayHistory.slice(0, 15).map((round, index) => (
                <div key={round.roundId || index} className="history-item">
                  <div className="round-info">
                    <div className="round-id">
                      <span className="round-number">#{round.roundId}</span>
                      <span className="round-ago">{Math.floor((Date.now() - round.timestamp) / 1000)}с назад</span>
                    </div>
                    <div className="round-time">{formatTime(round.timestamp)}</div>
                  </div>
                  
                  <div className="round-result">
                    <div 
                      className={`crash-multiplier ${getMultiplierClass(round.crashPoint)}`}
                      style={{ color: getMultiplierColor(round.crashPoint) }}
                    >
                      {round.crashPoint >= 10 ? '🚀' : round.crashPoint >= 5 ? '🔥' : round.crashPoint >= 2 ? '⚡' : '💥'} 
                      <span className="multiplier-value">{round.crashPoint.toFixed(2)}x</span>
                    </div>
                  </div>
                  
                  <div className="round-stats">
                    <div className="stat">
                      <span className="stat-icon">👥</span>
                      <span className="stat-value">{round.totalBets || 0}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">💰</span>
                      <span className="stat-value">{(round.totalAmount || 0).toFixed(0)} USDT</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* УЛУЧШЕННАЯ: Статистика по истории с дополнительной информацией */}
      {displayHistory.length > 0 && (
        <div className="history-stats">
          <div className="stats-title">📊 Статистика последних {displayHistory.length} раундов:</div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Средний:</span>
              <span className="stat-value">
                {(displayHistory.reduce((sum, round) => sum + round.crashPoint, 0) / displayHistory.length).toFixed(2)}x
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Макс.:</span>
              <span className="stat-value">
                🚀 {Math.max(...displayHistory.map(round => round.crashPoint)).toFixed(2)}x
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Мин.:</span>
              <span className="stat-value">
                💥 {Math.min(...displayHistory.map(round => round.crashPoint)).toFixed(2)}x
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">≥ 1.5x:</span>
              <span className="stat-value">
                {Math.round((displayHistory.filter(round => round.crashPoint >= 1.5).length / displayHistory.length) * 100)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">≥ 2x:</span>
              <span className="stat-value">
                {Math.round((displayHistory.filter(round => round.crashPoint >= 2).length / displayHistory.length) * 100)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">≥ 5x:</span>
              <span className="stat-value">
                {Math.round((displayHistory.filter(round => round.crashPoint >= 5).length / displayHistory.length) * 100)}%
              </span>
            </div>
          </div>
          
          {/* НОВОЕ: Дополнительная информация о скорости игры */}
          <div className="speed-info">
            <div className="speed-note">
              ⚡ Игра замедлена для лучшего опыта - множители растут плавнее!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrashHistory;
