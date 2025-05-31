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

  // УРЕЗАННЫЕ коэффициенты - плавное снижение к концу
  const payoutTables = {
    3: { // Урезано в 2 раза для последних коэффициентов
      1: 1.13, 2: 1.29, 3: 1.48, 4: 1.71, 5: 2.00, 6: 2.35, 7: 2.79, 8: 3.35, 9: 4.07, 10: 5.00,
      11: 6.26, 12: 7.96, 13: 10.35, 14: 13.80, 15: 18.98, 16: 27.11, 17: 35.55, 18: 48.80,
      19: 75.90, 20: 136.62, 21: 284.63, 22: 1138.50
    },
    5: { // Урезано в 3 раза для последних коэффициентов
      1: 1.24, 2: 1.56, 3: 2.00, 4: 2.58, 5: 3.39, 6: 4.52, 7: 6.14, 8: 8.50, 9: 12.04, 10: 17.52,
      11: 26.27, 12: 40.87, 13: 62.56, 14: 96.14, 15: 139.15, 16: 208.73, 17: 313.09, 18: 501.47,
      19: 876.65, 20: 1753.29
    },
    7: { // Урезано в 3 раза для последних коэффициентов  
      1: 1.38, 2: 1.94, 3: 2.79, 4: 4.09, 5: 6.14, 6: 9.44, 7: 14.95, 8: 24.47, 9: 41.60, 10: 73.95,
      11: 138.66, 12: 258.46, 13: 461.07, 14: 841.23, 15: 1588.31, 16: 3154.81, 17: 6609.63, 18: 15862.90
    },
    9: { // Урезано в 3 раза для последних коэффициентов
      1: 1.55, 2: 2.48, 3: 4.07, 4: 6.88, 5: 12.04, 6: 21.89, 7: 41.60, 8: 83.20, 9: 176.80, 10: 404.10,
      11: 942.42, 12: 2262.58, 13: 5795.93, 14: 15345.85, 15: 50563.38, 16: 202545.25
    },
    12: { // Урезано в 3 раза для последних коэффициентов
      1: 1.90, 2: 3.81, 3: 7.96, 4: 17.52, 5: 40.87, 6: 102.17, 7: 277.33, 8: 831.98, 9: 2640.21, 10: 9428.28,
      11: 37713.13, 12: 188565.62, 13: 1716099.00
    },
    15: { // Урезано в 3 раза для последних коэффициентов
      1: 2.48, 2: 6.60, 3: 18.98, 4: 59.64, 5: 208.73, 6: 834.90, 7: 3702.73, 8: 18513.65, 9: 111081.84, 10: 1078690.80
    },
    18: { // Урезано в 3 раза для последних коэффициентов
      1: 3.54, 2: 14.14, 3: 65.06, 4: 357.81, 5: 2336.17, 6: 19564.17, 7: 238946.00
    },
    21: { // Урезано в 3 раза для последних коэффициентов
      1: 6.19, 2: 49.50, 3: 531.39, 4: 8349.00
    },
    23: { // Урезано в 2 раза для последних коэффициентов
      1: 12.38, 2: 148.50
    }
  };

  // Функция для получения максимального коэффициента для определенного количества мин
  const getMaxMultiplier = (mines) => {
    const table = payoutTables[mines];
    if (!table) return 1;
    
    // Находим максимальный ключ (количество открытых ячеек) в таблице
    const maxRevealed = Math.max(...Object.keys(table).map(Number));
    return table[maxRevealed];
  };

  // Расчет максимального возможного выигрыша
  const maxPossibleWin = useMemo(() => {
    const maxMultiplier = getMaxMultiplier(minesCount);
    return betAmount * maxMultiplier;
  }, [betAmount, minesCount]);

  // Получаем максимальный множитель для отображения
  const maxMultiplier = useMemo(() => {
    return getMaxMultiplier(minesCount);
  }, [minesCount]);

  // Получаем количество безопасных ячеек, которые нужно открыть для максимального выигрыша
  const maxSafeCells = useMemo(() => {
    const table = payoutTables[minesCount];
    if (!table) return 0;
    return Math.max(...Object.keys(table).map(Number));
  }, [minesCount]);

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
        
        {/* Отображение максимального возможного выигрыша с УРЕЗАННЫМИ коэффициентами */}
        <div className="max-win-display">
          <div className="max-win-content">
            <span className="max-win-label">Макс. выигрыш:</span>
            <span className="max-win-value">
              {maxPossibleWin >= 1000000 
                ? `${(maxPossibleWin / 1000000).toFixed(2)}M` 
                : maxPossibleWin >= 1000 
                ? `${(maxPossibleWin / 1000).toFixed(1)}K`
                : maxPossibleWin.toFixed(2)} USDT
            </span>
          </div>
          <div className="max-win-multiplier">
            <span className="multiplier-text">
              при x{maxMultiplier >= 1000000 
                ? `${(maxMultiplier / 1000000).toFixed(1)}M` 
                : maxMultiplier >= 1000 
                ? `${(maxMultiplier / 1000).toFixed(1)}K`
                : maxMultiplier.toFixed(2)} 
              ({maxSafeCells} ячеек)
            </span>
          </div>
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
