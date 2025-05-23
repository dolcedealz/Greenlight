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
  autoplayRemaining
}) => {
  const [maxWin, setMaxWin] = useState(0);
  
  // Рассчитываем максимальный возможный выигрыш
  useEffect(() => {
    const jackpotMultiplier = 50; // Максимальный множитель для 🎰
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
  
  // Быстрые ставки
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
        
        <div className="quick-bets">
          <button 
            onClick={() => handleQuickBet(0.1)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn"
          >
            10%
          </button>
          <button 
            onClick={() => handleQuickBet(0.25)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn"
          >
            25%
          </button>
          <button 
            onClick={() => handleQuickBet(0.5)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn"
          >
            50%
          </button>
          <button 
            onClick={() => handleQuickBet(1)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn"
          >
            MAX
          </button>
        </div>
      </div>
      
      {/* Информация о выигрыше */}
      <div className={`win-info ${autoplay && autoplayRemaining > 0 ? 'has-autoplay' : ''}`}>
        <div className="info-item">
          <span className="info-label">Макс. выигрыш:</span>
          <span className="info-value">{maxWin.toFixed(2)} USDT</span>
        </div>
        <div className="info-item">
          <span className="info-label">Баланс:</span>
          <span className="info-value">{balance.toFixed(2)} USDT</span>
        </div>
        {autoplay && autoplayRemaining > 0 && (
          <div className="info-item autoplay-info">
            <span className="info-label">Осталось:</span>
            <span className="info-value">{autoplayRemaining} спинов</span>
          </div>
        )}
      </div>
      
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
      </div>
      
      {/* Дополнительные кнопки */}
      <div className="additional-controls">
        <button 
          className="control-btn"
          onClick={() => setBetAmount(Math.max(0.1, betAmount / 2))}
          disabled={isSpinning || loading || autoplay}
        >
          ÷2 Ставка
        </button>
        <button 
          className="control-btn"
          onClick={() => setBetAmount(Math.min(balance, betAmount * 2))}
          disabled={isSpinning || loading || autoplay}
        >
          ×2 Ставка
        </button>
      </div>
    </div>
  );
};

export default SlotControls;
