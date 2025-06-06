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
  loading,
  hideActionButtons = false // НОВОЕ: Флаг для скрытия кнопок действий
}) => {
  const { 
    buttonPressFeedback, 
    selectionChanged
  } = useTactileFeedback();

  // УРЕЗАННЫЕ коэффициенты на 5% (умножены на 0.95) для прибыли казино
  const payoutTables = {
    3: {
      1: 1.07, 2: 1.23, 3: 1.41, 4: 1.62, 5: 1.90, 6: 2.23, 7: 2.65, 8: 3.18, 9: 3.87, 10: 4.75,
      11: 5.95, 12: 7.56, 13: 9.83, 14: 13.11, 15: 18.03, 16: 25.75, 17: 33.77, 18: 46.36,
      19: 72.11, 20: 129.79, 21: 270.40, 22: 1081.58
    },
    5: {
      1: 1.18, 2: 1.48, 3: 1.90, 4: 2.45, 5: 3.22, 6: 4.29, 7: 5.83, 8: 8.08, 9: 11.44, 10: 16.64,
      11: 24.96, 12: 38.83, 13: 59.43, 14: 91.33, 15: 132.19, 16: 198.29, 17: 297.43, 18: 476.40,
      19: 832.82, 20: 1665.62
    },
    7: {
      1: 1.31, 2: 1.84, 3: 2.65, 4: 3.89, 5: 5.83, 6: 8.97, 7: 14.20, 8: 23.25, 9: 39.52, 10: 70.25,
      11: 131.73, 12: 245.54, 13: 438.02, 14: 799.17, 15: 1508.89, 16: 2997.07, 17: 6279.15, 18: 15069.76
    },
    9: {
      1: 1.47, 2: 2.36, 3: 3.87, 4: 6.54, 5: 11.44, 6: 20.80, 7: 39.52, 8: 79.04, 9: 167.96, 10: 383.90,
      11: 895.30, 12: 2149.45, 13: 5506.13, 14: 14578.56, 15: 48035.21, 16: 192417.99
    },
    12: {
      1: 1.81, 2: 3.62, 3: 7.56, 4: 16.64, 5: 38.83, 6: 97.06, 7: 263.46, 8: 790.38, 9: 2508.20, 10: 8956.87,
      11: 35827.47, 12: 179137.34, 13: 1630294.05
    },
    15: {
      1: 2.36, 2: 6.27, 3: 18.03, 4: 56.66, 5: 198.29, 6: 793.16, 7: 3517.59, 8: 17579.97, 9: 105527.75, 10: 1024756.26
    },
    18: {
      1: 3.36, 2: 13.43, 3: 61.81, 4: 339.92, 5: 2219.36, 6: 18585.96, 7: 226998.70
    },
    21: {
      1: 5.88, 2: 47.03, 3: 504.82, 4: 7931.55
    },
    23: {
      1: 11.76, 2: 141.08
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
    const safeMinesCount = minesCount || 5;
    const maxMultiplier = getMaxMultiplier(safeMinesCount);
    return betAmount * maxMultiplier;
  }, [betAmount, minesCount]);

  // Получаем максимальный множитель для отображения
  const maxMultiplier = useMemo(() => {
    const safeMinesCount = minesCount || 5;
    return getMaxMultiplier(safeMinesCount);
  }, [minesCount]);

  // Получаем количество безопасных ячеек, которые нужно открыть для максимального выигрыша
  const maxSafeCells = useMemo(() => {
    const safeMinesCount = minesCount || 5;
    const table = payoutTables[safeMinesCount];
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

  // Обработчик автоигры
  const handleAutoplayChange = (checked) => {
    selectionChanged(); // Вибрация при переключении
    if (onAutoplayChange) {
      onAutoplayChange(checked);
    }
  };
  
  // Для отображения в интерфейсе
  const safeTotal = 25 - (minesCount || 5);
  
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
          <label>Количество мин: <span className="selected-mines-count">{minesCount || 5}</span></label>
        </div>
        
        {/* Отображение максимального возможного выигрыша с коэффициентами -5% */}
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
      
      {/* УСЛОВНОЕ ОТОБРАЖЕНИЕ: Секция с кнопками действий (скрыта если hideActionButtons=true) */}
      {!hideActionButtons && (
        <div className="mines-actions">
          {!gameActive ? (
            <button 
              className="play-button" 
              onClick={onPlay}
              disabled={!betAmount || betAmount <= 0 || betAmount > balance || loading}
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
      )}
      
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
