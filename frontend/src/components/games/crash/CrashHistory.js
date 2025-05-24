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
  
  // Генерация тестовых данных истории, если история пуста
  const getDisplayHistory = () => {
    if (history && history.length > 0) {
      return history;
    }
    
    // Тестовые данные для демонстрации
    return [
      {
        roundId: 1001,
        crashPoint: 2.45,
        timestamp: Date.now() - 60000,
        totalBets: 5,
        totalAmount: 127.5
      },
      {
        roundId: 1000,
        crashPoint: 1.23,
        timestamp: Date.now() - 120000,
        totalBets: 3,
        totalAmount: 45.2
      },
      {
        roundId: 999,
        crashPoint: 8.91,
        timestamp: Date.now() - 180000,
        totalBets: 7,
        totalAmount: 89.1
      },
      {
        roundId: 998,
        crashPoint: 1.05,
        timestamp: Date.now() - 240000,
        totalBets: 2,
        totalAmount: 25.0
      },
      {
        roundId: 997,
        crashPoint: 15.67,
        timestamp: Date.now() - 300000,
        totalBets: 4,
        totalAmount: 67.8
      },
      {
        roundId: 996,
        crashPoint: 3.21,
        timestamp: Date.now() - 360000,
        totalBets: 6,
        totalAmount: 156.3
      },
      {
        roundId: 995,
        crashPoint: 1.85,
        timestamp: Date.now() - 420000,
        totalBets: 8,
        totalAmount: 203.7
      },
      {
        roundId: 994,
        crashPoint: 6.45,
        timestamp: Date.now() - 480000,
        totalBets: 5,
        totalAmount: 112.9
      }
    ];
  };
  
  const displayHistory = getDisplayHistory();
  
  return (
    <div className="crash-history">
      <div className="history-header">
        <h3 className="history-title">История раундов</h3>
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
            {/* Компактный вид - последние 10 раундов в одной строке */}
            <div className="history-compact">
              <div className="compact-title">Последние раунды:</div>
              <div className="compact-list">
                {displayHistory.slice(0, 10).map((round, index) => (
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
            
            {/* Детальный список */}
            <div className="history-detailed">
              {displayHistory.slice(0, 15).map((round, index) => (
                <div key={round.roundId || index} className="history-item">
                  <div className="round-info">
                    <div className="round-id">#{round.roundId}</div>
                    <div className="round-time">{formatTime(round.timestamp)}</div>
                  </div>
                  
                  <div className="round-result">
                    <div 
                      className={`crash-multiplier ${getMultiplierClass(round.crashPoint)}`}
                      style={{ color: getMultiplierColor(round.crashPoint) }}
                    >
                      {round.crashPoint.toFixed(2)}x
                    </div>
                  </div>
                  
                  <div className="round-stats">
                    <div className="stat">
                      <span className="stat-label">Ставок:</span>
                      <span className="stat-value">{round.totalBets || 0}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Сумма:</span>
                      <span className="stat-value">{(round.totalAmount || 0).toFixed(1)} USDT</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Статистика по истории */}
      {displayHistory.length > 0 && (
        <div className="history-stats">
          <div className="stats-title">Статистика последних {displayHistory.length} раундов:</div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Средний краш:</span>
              <span className="stat-value">
                {(displayHistory.reduce((sum, round) => sum + round.crashPoint, 0) / displayHistory.length).toFixed(2)}x
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Макс. краш:</span>
              <span className="stat-value">
                {Math.max(...displayHistory.map(round => round.crashPoint)).toFixed(2)}x
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Мин. краш:</span>
              <span className="stat-value">
                {Math.min(...displayHistory.map(round => round.crashPoint)).toFixed(2)}x
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
            <div className="stat-item">
              <span className="stat-label">≥ 10x:</span>
              <span className="stat-value">
                {Math.round((displayHistory.filter(round => round.crashPoint >= 10).length / displayHistory.length) * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrashHistory;
