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
      buttonPressFeedback();
    }
  };
  
  // Быстрые кнопки для ставки
  const handleQuickBet = (multiplier) => {
    buttonPressFeedback();
    const quickBet = Math.min(balance, Math.max(0.01, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Обработчик выбора стороны
  const handleSideSelection = (side) => {
    if (!isFlipping) {
      selectionChanged();
      setSelectedSide(side);
    }
  };
  
  // Обработчик нажатия кнопки подбрасывания
  const handleFlipClick = () => {
    if (betAmount <= 0 || betAmount > balance || isFlipping) return;
    
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
      {/* КНОПКА ИГРЫ ПЕРЕМЕЩЕНА ВВЕРХ */}
      <button 
        className="flip-button" 
        onClick={handleFlipClick}
        disabled={isFlipping || betAmount <= 0 || betAmount > balance}
      >
        <div className="button-content">
          {isFlipping ? (
            <>
              <div className="button-spinner"></div>
              <span>Подбрасываем...</span>
            </>
          ) : (
            <>
              <span className="button-icon">🪙</span>
              <span>Подбросить монету</span>
            </>
          )}
        </div>
      </button>
      
      {/* Выбор стороны - ИСПРАВЛЕНО: добавлена правильная иконка для решки */}
      <div className="side-selection">
        <h3 className="selection-title">Выберите сторону</h3>
        <div className="side-options">
          <div 
            className={`side-option heads ${selectedSide === 'heads' ? 'selected' : ''}`}
            onClick={() => handleSideSelection('heads')}
          >
            <div className="side-visual">
              <div className="side-icon">₿</div>
              <div className="side-glow"></div>
            </div>
            <div className="side-info">
              <div className="side-name">ОРЁЛ</div>
              <div className="side-odds">x2.00</div>
            </div>
            {selectedSide === 'heads' && <div className="selection-indicator">✓</div>}
          </div>
          
          <div 
            className={`side-option tails ${selectedSide === 'tails' ? 'selected' : ''}`}
            onClick={() => handleSideSelection('tails')}
          >
            <div className="side-visual">
              <div className="side-icon">💎</div>
              <div className="side-glow"></div>
            </div>
            <div className="side-info">
              <div className="side-name">РЕШКА</div>
              <div className="side-odds">x2.00</div>
            </div>
            {selectedSide === 'tails' && <div className="selection-indicator">✓</div>}
          </div>
        </div>
      </div>
      
      {/* Управление ставкой */}
      <div className="bet-control-section">
        <div className="bet-control">
          <label className="bet-label">Ставка (USDT):</label>
          <div className="bet-input-container">
            <div className="input-wrapper">
              <input
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                value={betAmount}
                onChange={handleBetAmountChange}
                disabled={isFlipping}
                className="bet-input"
                placeholder="0.00"
              />
              <div className="input-currency">USDT</div>
            </div>
          </div>
          
          <div className="bet-info">
            <div className="potential-win">
              <span className="info-label">Возможный выигрыш:</span>
              <span className="info-value">{potentialWin} USDT</span>
            </div>
            <div className="win-chance">
              <span className="info-label">Шанс выигрыша:</span>
              <span className="info-value">50%</span>
            </div>
          </div>
        </div>
        
        {/* Быстрые ставки */}
        <div className="quick-bets">
          <div className="quick-bets-label">Быстрые ставки:</div>
          <div className="quick-bets-buttons">
            <button 
              className="quick-bet-btn" 
              onClick={() => handleQuickBet(0.1)} 
              disabled={isFlipping}
            >
              10%
            </button>
            <button 
              className="quick-bet-btn" 
              onClick={() => handleQuickBet(0.25)} 
              disabled={isFlipping}
            >
              25%
            </button>
            <button 
              className="quick-bet-btn" 
              onClick={() => handleQuickBet(0.5)} 
              disabled={isFlipping}
            >
              50%
            </button>
            <button 
              className="quick-bet-btn max" 
              onClick={() => handleQuickBet(1)} 
              disabled={isFlipping}
            >
              MAX
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinControls;
