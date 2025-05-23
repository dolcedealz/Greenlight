// frontend/src/components/games/slots/SlotControls.js
import React, { useState, useEffect } from 'react';
import '../../../styles/SlotControls.css';

const SlotControls = ({ 
  balance, 
  onSpin, 
  isSpinning, 
  betAmount,
  setBetAmount,
  autoplay,
  setAutoplay,
  autoplayCount,
  setAutoplayCount,
  loading,
  autoplayRemaining,
  gameStats
}) => {
  const [maxWin, setMaxWin] = useState(0);
  
  // Рассчитываем максимальный возможный выигрыш
  useEffect(() => {
    const jackpotMultiplier = 100; // Максимальный множитель для jackpot
    setMaxWin(betAmount * jackpotMultiplier);
  }, [betAmount]);
  
  // Обработчик изменения суммы ставки
  const handleBetAmountChange = (e) => {
    const inputValue = e.target.value;
    
    if (inputValue === '' || inputValue === '0') {
      setBetAmount(inputValue);
      return;
    }
    
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 0 && value <= balance) {
      setBetAmount(value);
    }
  };
  
  // Быстрые ставки - только 1% и 5%
  const handleQuickBet = (multiplier) => {
    const quickBet = Math.min(balance, Math.max(0.1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Обработчик кнопки "Крутить"
  const handleSpinClick = () => {
    if (betAmount <= 0 || betAmount > balance || isSpinning || loading) return;
    onSpin();
  };
  
  // Обработчик автоигры
  const handleAutoplayToggle = () => {
    setAutoplay(!autoplay);
  };
  
  // Обработчик изменения количества автоспинов
  const handleAutoplayCountChange = (count) => {
    setAutoplayCount(count);
  };
  
  return (
    <div className="slot-controls">
      {/* Кнопка спина */}
      <div className="spin-section">
        <button 
          className={`spin-button ${isSpinning ? 'spinning' : ''} ${autoplay ? 'autoplay-active' : ''}`}
          onClick={handleSpinClick}
          disabled={isSpinning || loading || betAmount <= 0 || betAmount > balance || autoplay}
        >
          {isSpinning ? (
            <span className="spin-text spinning-text">
              <span className="spinner">🎰</span> Крутим...
            </span>
          ) : autoplay ? (
            <span className="spin-text">
              🤖 АВТОИГРА АКТИВНА
            </span>
          ) : (
            <span className="spin-text">
              🎰 КРУТИТЬ ({betAmount} USDT)
            </span>
          )}
        </button>
      </div>
      
      {/* Управление ставкой */}
      <div className="bet-section">
        <div className="bet-control">
          <label>Ставка (USDT):</label>
          <div className="bet-input-container">
            <input
              type="number"
              min="0.1"
              max={balance}
              step="0.1"
              value={betAmount}
              onChange={handleBetAmountChange}
              disabled={isSpinning || loading || autoplay}
            />
          </div>
        </div>
        
        {/* Только 2 кнопки - 1% и 5% в столбик */}
        <div className="quick-bets">
          <button 
            onClick={() => handleQuickBet(0.01)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn large"
          >
            1%
          </button>
          <button 
            onClick={() => handleQuickBet(0.05)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn large"
          >
            5%
          </button>
        </div>
      </div>
      
      {/* Автоигра */}
      <div className="autoplay-section">
        <div className="autoplay-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={handleAutoplayToggle}
              disabled={isSpinning || loading}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Автоигра</span>
          </label>
          {autoplay && (
            <button 
              className="stop-autoplay-btn"
              onClick={() => setAutoplay(false)}
              disabled={loading}
            >
              Остановить
            </button>
          )}
        </div>
        
        {!autoplay && (
          <div className="autoplay-settings">
            <div className="autoplay-count">
              <label>Количество спинов:</label>
              <div className="count-buttons">
                {[10, 25, 50, 100].map(count => (
                  <button
                    key={count}
                    className={`count-btn ${autoplayCount === count ? 'active' : ''}`}
                    onClick={() => handleAutoplayCountChange(count)}
                    disabled={isSpinning || loading}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="autoplay-info">
              <small>
                Автоигра остановится при достижении лимита спинов, недостатке средств или большом выигрыше
              </small>
            </div>
          </div>
        )}
        
        {autoplay && autoplayRemaining > 0 && (
          <div className="autoplay-status">
            <span>Осталось спинов: {autoplayRemaining}</span>
          </div>
        )}
      </div>
      
      {/* Таблица выплат с PNG изображениями */}
      <div className="payout-table">
        <h4>Таблица выплат</h4>
        <div className="payout-rules">
          <div className="payout-rule">
            <span className="rule-text">3 в ряд</span>
            <span className="rule-multiplier">×(половина коэффициента)</span>
          </div>
          <div className="payout-rule">
            <span className="rule-text">4 в ряд</span>
            <span className="rule-multiplier">×(полный коэффициент)</span>
          </div>
        </div>
        <div className="payout-grid">
          {[
            { symbol: 'cherry', payout: 4, threeInRow: 2, img: '/assets/images/slots/cherry final png.png' },
            { symbol: 'lemon', payout: 6, threeInRow: 3, img: '/assets/images/slots/lemon final png.png' },
            { symbol: 'persik', payout: 8, threeInRow: 4, img: '/assets/images/slots/persik final png.png' },
            { symbol: 'grape', payout: 12, threeInRow: 6, img: '/assets/images/slots/grape final png.png' },
            { symbol: 'bell', payout: 18, threeInRow: 9, img: '/assets/images/slots/bell final png.png' },
            { symbol: 'diamond', payout: 30, threeInRow: 15, img: '/assets/images/slots/diamond final png.png' },
            { symbol: 'star', payout: 50, threeInRow: 25, img: '/assets/images/slots/star final png.png' },
            { symbol: 'jackpot', payout: 100, threeInRow: 50, img: '/assets/images/slots/jackpot final png.png' }
          ].map((symbolData, index) => (
            <div key={index} className="payout-item">
              <img 
                src={symbolData.img} 
                alt={symbolData.symbol}
                className="payout-symbol-img"
                onError={(e) => {
                  const fallbackEmojis = {
                    'cherry': '🍒',
                    'lemon': '🍋',
                    'persik': '🍑',
                    'grape': '🍇',
                    'bell': '🔔',
                    'diamond': '💎',
                    'star': '⭐',
                    'jackpot': '🎰'
                  };
                  e.target.outerHTML = `<span class="payout-symbol">${fallbackEmojis[symbolData.symbol] || '🍒'}</span>`;
                }}
              />
              <span className="payout-multiplier">4×{symbolData.payout} | 3×{symbolData.threeInRow}</span>
            </div>
          ))}
        </div>
        <div className="payout-note">
          * Первое число - выигрыш за 4 в ряд, второе - за 3 в ряд
        </div>
      </div>
      
      {/* Статистика */}
      {gameStats && (
        <div className="game-stats">
          <h4>Ваша статистика</h4>
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-label">Всего игр:</span>
              <span className="stat-value">{gameStats.totalGames}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Победы:</span>
              <span className="stat-value">{gameStats.winCount} ({(gameStats.winRate * 100).toFixed(1)}%)</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Ставки:</span>
              <span className="stat-value">{gameStats.totalBet?.toFixed(2) || 0} USDT</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Выигрыши:</span>
              <span className="stat-value">{gameStats.totalWin?.toFixed(2) || 0} USDT</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Профит:</span>
              <span className={`stat-value ${(gameStats.totalWin - gameStats.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
                {((gameStats.totalWin || 0) - (gameStats.totalLoss || 0)).toFixed(2)} USDT
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotControls;
