// frontend/src/components/games/coin/CoinControls.js
import React, { useState } from 'react';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import '../../../styles/CoinControls.css';

const CoinControls = ({ onFlip, isFlipping, balance, lastResults }) => {
  const [betAmount, setBetAmount] = useState(1);
  const [selectedSide, setSelectedSide] = useState('heads');
  
  const { 
    buttonPressFeedback, 
    selectionChanged, 
    gameActionFeedback, 
    importantActionFeedback 
  } = useTactileFeedback();
  
  // Обработчик изменения суммы ставки
  const handleBetAmountChange = (e) => {
    const inputValue = e.target.value;
    
    // Разрешаем пустое значение или 0 для ввода
    if (inputValue === '' || inputValue === '0') {
      setBetAmount(inputValue);
      return;
    }
    
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 0 && value <= balance) {
      setBetAmount(value);
      buttonPressFeedback(); // Легкая вибрация при изменении ставки
    }
  };
  
  // Быстрые кнопки для ставки
  const handleQuickBet = (multiplier) => {
    buttonPressFeedback(); // Вибрация при нажатии быстрой ставки
    const quickBet = Math.min(balance, Math.max(1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Обработчик выбора стороны
  const handleSideSelection = (side) => {
    if (!isFlipping) {
      selectionChanged(); // Вибрация при смене выбора
      setSelectedSide(side);
    }
  };
  
  // Обработчик нажатия кнопки подбрасывания
  const handleFlipClick = () => {
    if (betAmount <= 0 || betAmount > balance || isFlipping) return;
    
    // Сильная вибрация для главного игрового действия
    importantActionFeedback();
    
    if (onFlip) {
      onFlip({
        betAmount: parseFloat(betAmount),
        selectedSide
      });
    }
  };

  // Вычисляем потенциальный выигрыш
  const potentialWin = (parseFloat(betAmount) * 2.0).toFixed(2);

  return (
    <div className="coin-controls">
      <div className="side-selection">
        <div 
          className={`side-option ${selectedSide === 'heads' ? 'selected' : ''}`}
          onClick={() => handleSideSelection('heads')}
        >
          <div className="side-icon">O</div>
          <div className="side-name">Орёл</div>
        </div>
        
        <div 
          className={`side-option ${selectedSide === 'tails' ? 'selected' : ''}`}
          onClick={() => handleSideSelection('tails')}
        >
          <div className="side-icon">P</div>
          <div className="side-name">Решка</div>
        </div>
      </div>
      
      <div className="bet-control">
        <label>Ставка (USDT):</label>
        <div className="bet-input-container">
          <input
            type="number"
            min="0"
            max={balance}
            step="0.1"
            value={betAmount}
            onChange={handleBetAmountChange}
            disabled={isFlipping}
          />
          <span className="potential-win">
            Возможный выигрыш: <strong>{potentialWin} USDT</strong>
          </span>
        </div>
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
