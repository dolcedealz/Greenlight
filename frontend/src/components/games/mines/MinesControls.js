// frontend/src/components/games/mines/MinesControls.js
import React, { useState, useEffect } from 'react';
import '../../../styles/MinesControls.css';

const MinesControls = ({ 
  balance, 
  onPlay, 
  onCashout, 
  gameActive, 
  currentMultiplier,
  possibleWin,
  betAmount,
  setBetAmount,
  minesCount,
  setMinesCount,
  revealedCount,
  onAutoplayChange,
  autoplay
}) => {
  const [isAutoplay, setIsAutoplay] = useState(false);
  
  // Обработчик изменения суммы ставки
  const handleBetAmountChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0 && value <= balance) {
      setBetAmount(value);
    }
  };
  
  // Быстрые кнопки для ставки
  const handleQuickBet = (multiplier) => {
    const quickBet = Math.min(balance, Math.max(1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Обработчик изменения количества мин
  const handleMinesCountChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 24) {
      setMinesCount(value);
    }
  };
  
  // Быстрые кнопки для количества мин
  const handleQuickMines = (count) => {
    setMinesCount(count);
  };
  
  // Обработчик переключения автоигры
  const toggleAutoplay = () => {
    setIsAutoplay(!isAutoplay);
    onAutoplayChange && onAutoplayChange(!isAutoplay);
  };
  
  return (
    <div className="mines-controls">
      <div className="mines-bet-section">
        <div className="mines-bet-control">
          <label>Ставка (USDT):</label>
          <div className="bet-input-container">
            <input
              type="number"
              min="1"
              max={balance}
              step="0.1"
              value={betAmount}
              onChange={handleBetAmountChange}
              disabled={gameActive}
            />
          </div>
        </div>
        
        <div className="quick-bets">
          <button onClick={() => handleQuickBet(0.1)} disabled={gameActive}>10%</button>
          <button onClick={() => handleQuickBet(0.25)} disabled={gameActive}>25%</button>
          <button onClick={() => handleQuickBet(0.5)} disabled={gameActive}>50%</button>
          <button onClick={() => handleQuickBet(1)} disabled={gameActive}>MAX</button>
        </div>
      </div>
      
      <div className="mines-count-section">
        <div className="mines-count-control">
          <label>Количество мин:</label>
          <div className="mines-input-container">
            <input
              type="number"
              min="1"
              max="24"
              step="1"
              value={minesCount}
              onChange={handleMinesCountChange}
              disabled={gameActive}
            />
            <span className="mines-info">
              (1-24)
            </span>
          </div>
        </div>
        
        <div className="quick-mines">
          <button onClick={() => handleQuickMines(3)} disabled={gameActive}>3</button>
          <button onClick={() => handleQuickMines(5)} disabled={gameActive}>5</button>
          <button onClick={() => handleQuickMines(10)} disabled={gameActive}>10</button>
          <button onClick={() => handleQuickMines(24)} disabled={gameActive}>24</button>
        </div>
      </div>
      
      <div className="mines-game-info">
        <div className="info-item">
          <span className="info-label">Множитель:</span>
          <span className="info-value">{currentMultiplier.toFixed(2)}x</span>
        </div>
        <div className="info-item">
          <span className="info-label">Выигрыш:</span>
          <span className="info-value">{possibleWin.toFixed(2)} USDT</span>
        </div>
        <div className="info-item">
          <span className="info-label">Открыто:</span>
          <span className="info-value">{revealedCount} из {25 - minesCount}</span>
        </div>
      </div>
      
      <div className="mines-actions">
        {!gameActive ? (
          <button 
            className="play-button" 
            onClick={onPlay}
            disabled={betAmount <= 0 || betAmount > balance}
          >
            Играть
          </button>
        ) : (
          <button 
            className="cashout-button" 
            onClick={onCashout}
          >
            Забрать выигрыш ({possibleWin.toFixed(2)} USDT)
          </button>
        )}
      </div>
      
      <div className="mines-autoplay">
        <label className="autoplay-toggle">
          <input 
            type="checkbox" 
            checked={isAutoplay} 
            onChange={toggleAutoplay}
            disabled={gameActive}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-text">Автоигра (авто-кешаут при x2)</span>
        </label>
      </div>
    </div>
  );
};

export default MinesControls;