// CoinControls.js
import React, { useState } from 'react';
import '../../../styles/CoinControls.css';

// Компонент для управления ставкой и запуском игры
const CoinControls = ({ onFlip, isFlipping, balance, lastResults }) => {
  const [betAmount, setBetAmount] = useState(1);
  const [selectedSide, setSelectedSide] = useState('heads'); // 'heads' или 'tails'
  
  // Обработчик изменения суммы ставки
  const handleBetAmountChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0 && value <= balance) {
      setBetAmount(value);
    }
  };
  
  // Быстрые кнопки для ставки
  const handleQuickBet = (multiplier) => {
    const quickBet = Math.min(balance, Math.max(1, Math.floor(balance * multiplier)));
    setBetAmount(quickBet);
  };
  
  // Обработчик нажатия кнопки подбрасывания
  const handleFlipClick = () => {
    if (betAmount <= 0 || betAmount > balance || isFlipping) return;
    
    onFlip({
      betAmount,
      selectedSide
    });
  };

  return (
    <div className="coin-controls">
      <div className="side-selection">
        <div 
          className={`side-option ${selectedSide === 'heads' ? 'selected' : ''}`}
          onClick={() => setSelectedSide('heads')}
        >
          <div className="side-icon">O</div>
          <div className="side-name">Орёл</div>
        </div>
        
        <div 
          className={`side-option ${selectedSide === 'tails' ? 'selected' : ''}`}
          onClick={() => setSelectedSide('tails')}
        >
          <div className="side-icon">P</div>
          <div className="side-name">Решка</div>
        </div>
      </div>
      
      <div className="bet-control">
        <label>Ставка (USDT):</label>
        <input
          type="number"
          min="1"
          max={balance}
          step="1"
          value={betAmount}
          onChange={handleBetAmountChange}
          disabled={isFlipping}
        />
      </div>
      
      <div className="quick-bets">
        <button onClick={() => handleQuickBet(0.1)} disabled={isFlipping}>10%</button>
        <button onClick={() => handleQuickBet(0.25)} disabled={isFlipping}>25%</button>
        <button onClick={() => handleQuickBet(0.5)} disabled={isFlipping}>50%</button>
        <button onClick={() => handleQuickBet(1)} disabled={isFlipping}>MAX</button>
      </div>
      
      <button 
        className="flip-button" 
        onClick={handleFlipClick}
        disabled={isFlipping || betAmount <= 0 || betAmount > balance}
      >
        {isFlipping ? 'Подбрасываем...' : 'Подбросить монету'}
      </button>
      
      {lastResults && lastResults.length > 0 && (
        <div className="last-results">
          <h4>Последние результаты:</h4>
          <div className="results-row">
            {lastResults.slice(0, 10).map((result, index) => (
              <div 
                key={index} 
                className={`result-indicator ${result === 'heads' ? 'heads' : 'tails'}`}
                title={result === 'heads' ? 'Орёл' : 'Решка'}
              >
                {result === 'heads' ? 'O' : 'P'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoinControls;