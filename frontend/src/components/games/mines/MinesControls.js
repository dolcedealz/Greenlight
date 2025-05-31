// frontend/src/components/games/mines/MinesControls.js
import React, { useMemo } from 'react';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
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
  const { 
    buttonPressFeedback, 
    selectionChanged, 
    gameActionFeedback, 
    importantActionFeedback,
    criticalActionFeedback 
  } = useTactileFeedback();

  // Функция расчета множителя для мин
  const calculateMinesMultiplier = (mines, revealed) => {
    if (revealed === 0) return 0.95; // Базовый множитель
    
    const totalCells = 25;
    const safeCells = totalCells - mines;
    const houseEdge = 0.95; // 95% RTP
    
    // Формула расчета множителя для игры мины
    let multiplier = houseEdge;
    for (let i = 0; i < revealed; i++) {
      multiplier *= (safeCells / (safeCells - i));
    }
    
    return multiplier;
  };

  // Расчет максимального возможного выигрыша
  const maxPossibleWin = useMemo(() => {
    const safeCells = 25 - minesCount;
    const maxMultiplier = calculateMinesMultiplier(minesCount, safeCells);
    return betAmount * maxMultiplier;
  }, [betAmount, minesCount]);

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
  
  // Быстрые ставки (процент от баланса)
  const handleQuickBet = (multiplier) => {
    buttonPressFeedback(); // Вибрация при быстрой ставке
    const quickBet = Math.min(balance, Math.max(1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Быстрый выбор количества мин
  const handleQuickMines = (count) => {
    selectionChanged(); // Вибрация при смене выбора мин
    setMinesCount(count);
  };
  
  // Обработчик кнопки играть
  const handlePlayClick = () => {
    gameActionFeedback(); // Вибрация для начала игры
    onPlay();
  };

  // Обработчик кнопки забрать выигрыш
  const handleCashoutClick = () => {
    criticalActionFeedback(); // Сильная вибрация для важного действия
    onCashout();
  };

  // Обработчик автоигры
  const handleAutoplayChange = (checked) => {
    selectionChanged(); // Вибрация при переключении
    onAutoplayChange(checked);
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
          <label>Количество мин: <span className="selected-mines-count">{minesCount}</span></label>
        </div>
        
        {/* Отображение максимального возможного выигрыша */}
        <div className="max-win-display">
          <span className="max-win-label">Макс. выигрыш:</span>
          <span className="max-win-value">{maxPossibleWin.toFixed(2)} USDT</span>
        </div>
        
        <div className="quick-mines">
          <button 
            onClick={() => handleQuickMines(3)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 3 ? 'active' : ''}`}
          >
            3
          </button>
          <button 
            onClick={() => handleQuickMines(5)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 5 ? 'active' : ''}`}
          >
            5
          </button>
          <button 
            onClick={() => handleQuickMines(7)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 7 ? 'active' : ''}`}
          >
            7
          </button>
        </div>
        <div className="quick-mines" style={{marginTop: '5px'}}>
          <button 
            onClick={() => handleQuickMines(9)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 9 ? 'active' : ''}`}
          >
            9
          </button>
          <button 
            onClick={() => handleQuickMines(12)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 12 ? 'active' : ''}`}
          >
            12
          </button>
          <button 
            onClick={() => handleQuickMines(15)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 15 ? 'active' : ''}`}
          >
            15
          </button>
        </div>
        <div className="quick-mines" style={{marginTop: '5px'}}>
          <button 
            onClick={() => handleQuickMines(18)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 18 ? 'active' : ''}`}
          >
            18
          </button>
          <button 
            onClick={() => handleQuickMines(21)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 21 ? 'active' : ''}`}
          >
            21
          </button>
          <button 
            onClick={() => handleQuickMines(23)} 
            disabled={gameActive || loading}
            className={`quick-mines-button ${minesCount === 23 ? 'active' : ''}`}
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
            onClick={handlePlayClick}
            disabled={betAmount <= 0 || betAmount > balance || loading}
          >
            {loading ? 'Загрузка...' : 'Играть'}
          </button>
        ) : (
          <button 
            className="cashout-button" 
            onClick={handleCashoutClick}
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
            onChange={(e) => handleAutoplayChange(e.target.checked)}
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
