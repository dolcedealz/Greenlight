// MinesControls.js
import React from 'react';
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
  autoplay,
  loading
}) => {
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
    }
  };
  
  // Быстрые ставки (процент от баланса)
  const handleQuickBet = (multiplier) => {
    const quickBet = Math.min(balance, Math.max(1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Обработчик изменения количества мин
  const handleMinesCountChange = (e) => {
    const value = parseInt(e.target.value, 10);
    // Список допустимых значений для количества мин
    const allowedValues = [3, 5, 7, 9, 12, 15, 18, 21, 23];
    
    if (!isNaN(value) && allowedValues.includes(value)) {
      setMinesCount(value);
    }
  };
  
  // Быстрый выбор количества мин
  const handleQuickMines = (count) => {
    setMinesCount(count);
  };
  
  // Для отображения в интерфейсе
  const safeTotal = 25 - minesCount;
  
  return (
    <div className="mines-controls">
      <div className="mines-bet-section">
        <div className="mines-bet-control">
          <label>Ставка (USDT):</label>
          <div className="bet-input-container">
            <input
              type="number"
              min="0"
              max={balance}
              step="0.1"
              value={betAmount}
              onChange={handleBetAmountChange}
              disabled={gameActive || loading}
            />
          </div>
        </div>
        
        <div className="quick-bets">
          <button 
            onClick={() => handleQuickBet(0.1)} 
            disabled={gameActive || loading}
            className="quick-bet-button"
          >
            10%
          </button>
          <button 
            onClick={() => handleQuickBet(0.25)} 
            disabled={gameActive || loading}
            className="quick-bet-button"
          >
            25%
          </button>
          <button 
            onClick={() => handleQuickBet(0.5)} 
            disabled={gameActive || loading}
            className="quick-bet-button"
          >
            50%
          </button>
          <button 
            onClick={() => handleQuickBet(1)} 
            disabled={gameActive || loading}
            className="quick-bet-button"
          >
            MAX
          </button>
        </div>
      </div>
      
      <div className="mines-count-section">
        <div className="mines-count-control">
          <label>Количество мин:</label>
          <div className="mines-input-container">
            <input
              type="number"
              value={minesCount}
              onChange={handleMinesCountChange}
              disabled={gameActive || loading}
            />
            <span className="mines-info">
              (3-23)
            </span>
          </div>
        </div>
        
        <div className="quick-mines">
          <button 
            onClick={() => handleQuickMines(3)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            3
          </button>
          <button 
            onClick={() => handleQuickMines(5)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            5
          </button>
          <button 
            onClick={() => handleQuickMines(7)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            7
          </button>
        </div>
        <div className="quick-mines" style={{marginTop: '5px'}}>
          <button 
            onClick={() => handleQuickMines(9)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            9
          </button>
          <button 
            onClick={() => handleQuickMines(12)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            12
          </button>
          <button 
            onClick={() => handleQuickMines(15)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            15
          </button>
        </div>
        <div className="quick-mines" style={{marginTop: '5px'}}>
          <button 
            onClick={() => handleQuickMines(18)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            18
          </button>
          <button 
            onClick={() => handleQuickMines(21)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            21
          </button>
          <button 
            onClick={() => handleQuickMines(23)} 
            disabled={gameActive || loading}
            className="quick-mines-button"
          >
            23
          </button>
        </div>
      </div>
      
      <div className="mines-game-info">
        <div className="info-item">
          <span className="info-label">Множитель:</span>
          <span className="info-value">{currentMultiplier.toFixed(2)}x</span>
        </div>
        <div className="info-item">
          <span className="info-label">Возможный выигрыш:</span>
          <span className="info-value">{possibleWin.toFixed(2)} USDT</span>
        </div>
        <div className="info-item">
          <span className="info-label">Открыто:</span>
          <span className="info-value">{revealedCount} из {safeTotal}</span>
        </div>
      </div>
      
      <div className="mines-actions">
        {!gameActive ? (
          <button 
            className="play-button" 
            onClick={onPlay}
            disabled={betAmount <= 0 || betAmount > balance || loading}
          >
            {loading ? 'Загрузка...' : 'Играть'}
          </button>
        ) : (
          <button 
            className="cashout-button" 
            onClick={onCashout}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : `Забрать выигрыш (${possibleWin.toFixed(2)} USDT)`}
          </button>
        )}
      </div>
      
      <div className="mines-autoplay">
        <label className="autoplay-toggle">
          <input 
            type="checkbox" 
            checked={autoplay} 
            onChange={(e) => onAutoplayChange(e.target.checked)}
            disabled={gameActive || loading}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-text">Автоигра (авто-кешаут при x2)</span>
        </label>
      </div>
    </div>
  );
};

export default React.memo(MinesControls);