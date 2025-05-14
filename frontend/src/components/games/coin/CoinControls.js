// frontend/src/components/games/coin/CoinControls.js
import React, { useState, useEffect } from 'react';
import '../../../styles/CoinControls.css';

const CoinControls = ({ onFlip, isFlipping, balance, lastResults }) => {
  const [betAmount, setBetAmount] = useState(1);
  const [selectedSide, setSelectedSide] = useState('heads'); // 'heads' или 'tails'
  const [clientSeed, setClientSeed] = useState(''); // Добавляем клиентский seed для честной игры
  const [showSeedInput, setShowSeedInput] = useState(false);
  
  // Генерируем случайный seed при первой загрузке
  useEffect(() => {
    setClientSeed(Math.random().toString(36).substring(2, 15));
  }, []);
  
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
  
  // Обработчик нажатия кнопки подбрасывания
  const handleFlipClick = () => {
    if (betAmount <= 0 || betAmount > balance || isFlipping) return;
    
    onFlip({
      betAmount,
      selectedSide,
      clientSeed
    });
    
    // Генерируем новый seed для следующей игры
    setClientSeed(Math.random().toString(36).substring(2, 15));
  };

  // Вычисляем потенциальный выигрыш
  const potentialWin = (betAmount * 1.95).toFixed(2);

  return (
    <div className="coin-controls">
      <div className="side-selection">
        <div 
          className={`side-option ${selectedSide === 'heads' ? 'selected' : ''}`}
          onClick={() => !isFlipping && setSelectedSide('heads')}
        >
          <div className="side-icon">O</div>
          <div className="side-name">Орёл</div>
        </div>
        
        <div 
          className={`side-option ${selectedSide === 'tails' ? 'selected' : ''}`}
          onClick={() => !isFlipping && setSelectedSide('tails')}
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
            min="1"
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
      
      <div className="advanced-options">
        <button 
          className="seed-toggle" 
          onClick={() => setShowSeedInput(!showSeedInput)}
          disabled={isFlipping}
        >
          {showSeedInput ? 'Скрыть дополнительно' : 'Показать дополнительно'}
        </button>
        
        {showSeedInput && (
          <div className="seed-input">
            <label>Клиентский seed (для проверки честности):</label>
            <input
              type="text"
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
              disabled={isFlipping}
            />
            <span className="seed-info">
              Seed используется для генерации результата игры. Вы можете изменить его для проверки честности игры.
            </span>
          </div>
        )}
      </div>
      
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