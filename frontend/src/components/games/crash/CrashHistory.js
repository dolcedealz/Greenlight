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
  
  // Генерация тестовых данных истории
  const getDisplayHistory = () => {
    if (history && history.length > 0) {
      return history;
    }
    
    // Тестовые данные для демонстрации
    return [
      {
        roundId: 1008,
        crashPoint: 1.85,
        timestamp: Date.now() - 4000,
        totalBets: 4,
        totalAmount: 89.5
      },
      {
        roundId: 1007,
        crashPoint: 3.42,
        timestamp: Date.now() - 8000,
        totalBets: 6,
        totalAmount: 156.3
      },
      {
        roundId: 1006,
        crashPoint: 1.12,
        timestamp: Date.now() - 12000,
        totalBets: 2,
        totalAmount: 25.0
      },
      {
        roundId: 1005,
        crashPoint: 7.89,
        timestamp: Date.now() - 16000,
        totalBets: 8,
        totalAmount: 203.7
      },
      {
        roundId: 1004,
        crashPoint: 2.45,
        timestamp: Date.now() - 20000,
        totalBets: 5,
        totalAmount: 127.5
      },
      {
        roundId: 1003,
        crashPoint: 1.23,
        timestamp: Date.now() - 24000,
        totalBets: 3,
        totalAmount: 45.2
      },
      {
        roundId: 1002,
        crashPoint: 15.67,
        timestamp: Date.now() - 28000,
        totalBets: 4,
        totalAmount: 67.8
      },
      {
        roundId: 1001,
        crashPoint: 4.21,
        timestamp: Date.now() - 32000,
        totalBets: 7,
        totalAmount: 189.4
      },
      {
        roundId: 1000,
        crashPoint: 1.05,
        timestamp: Date.now() - 36000,
        totalBets: 2,
        totalAmount: 18.5
      },
      {
        roundId: 999,
        crashPoint: 8.91,
        timestamp: Date.now() - 40000,
        totalBets: 7,
        totalAmount: 234.1
      },
      {
        roundId: 998,
        crashPoint: 2.78,
        timestamp: Date.now() - 44000,
        totalBets: 5,
        totalAmount: 98.7
      },
      {
        roundId: 997,
        crashPoint: 1.67,
        timestamp: Date.now() - 48000,
        totalBets: 4,
        totalAmount: 76.3
      }
    ];
  };
  
  const displayHistory = getDisplayHistory();
  
  return (
    <div className="crash-history">
      <div className="history-header">
        <h3 className="history-title">История</h3>
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
            
            {/* Детальный список */}
            <div className="history-detailed">
              {displayHistory.slice(0, 20).map((round, index) => (
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
                      {round.crashPoint >= 10 ? '🚀' : round.crashPoint >= 5 ? '🔥' : round.crashPoint >= 2 ? '⚡' : '💥'} {round.crashPoint.toFixed(2)}x
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
          <div className="stats-title">📊 Статистика последних {displayHistory.length} раундов:</div>
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
                🚀 {Math.max(...displayHistory.map(round => round.crashPoint)).toFixed(2)}x
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Мин. краш:</span>
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
        </div>
      )}
    </div>
  );
};

export default CrashHistory;
