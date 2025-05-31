// frontend/src/components/games/slots/SlotControls.js
import React, { useState, useEffect } from 'react';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
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
  autoplayRemaining,
  gameStats,
  onStopAutoplay // Новый проп для остановки автоспина
}) => {
  const [maxWin, setMaxWin] = useState(0);
  
  const { 
    buttonPressFeedback, 
    selectionChanged, 
    gameActionFeedback, 
    importantActionFeedback,
    heavyImpact 
  } = useTactileFeedback();
  
  // Рассчитываем максимальный возможный выигрыш
  useEffect(() => {
    const jackpotMultiplier = 50; // ИСПРАВЛЕНО: было 100, стало 50 (урезано в 2 раза)
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
      buttonPressFeedback(); // Легкая вибрация при изменении ставки
    }
  };
  
  // Быстрые ставки
  const handleQuickBet = (multiplier) => {
    if (isSpinning || loading || autoplay) return; // БЛОКИРУЕМ при спине
    
    buttonPressFeedback(); // Вибрация при быстрой ставке
    const quickBet = Math.min(balance, Math.max(0.1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Обработчик кнопки "Крутить"
  const handleSpinClick = () => {
    if (betAmount <= 0 || betAmount > balance || isSpinning || loading) return;
    
    // Сильная вибрация для главного игрового действия
    heavyImpact();
    onSpin();
  };
  
  // Обработчик автоигры - ИСПРАВЛЕННЫЙ
  const handleAutoplayToggle = () => {
    if (isSpinning || loading) return; // БЛОКИРУЕМ при спине
    
    selectionChanged(); // Вибрация при переключении
    console.log('СЛОТЫ CONTROLS: Переключение автоспина, текущее состояние:', autoplay);
    
    // Передаем правильный параметр в родительский компонент
    // setAutoplay ожидает enabled параметр, а не setState логику
    setAutoplay(!autoplay);
  };
  
  // Обработчик изменения количества автоспинов
  const handleAutoplayCountChange = (count) => {
    if (isSpinning || loading || autoplay) return; // БЛОКИРУЕМ при спине
    
    buttonPressFeedback(); // Легкая вибрация при выборе
    setAutoplayCount(count);
  };

  // Обработчик остановки автоигры - ИСПРАВЛЕННЫЙ
  const handleStopAutoplay = () => {
    gameActionFeedback(); // Вибрация при остановке
    console.log('СЛОТЫ CONTROLS: Нажата кнопка остановки автоспина');
    
    // Используем функцию из родительского компонента
    if (onStopAutoplay) {
      onStopAutoplay();
    } else {
      // Fallback к старому методу
      setAutoplay(false);
    }
  };
  
  // ИСПРАВЛЕННЫЕ КОЭФФИЦИЕНТЫ (урезаны в 2 раза)
  const slotSymbols = [
    { symbol: 'cherry', payout: 2, threeInRow: 1, emoji: '🍒' },        // было 4→2, было 2→1
    { symbol: 'lemon', payout: 3, threeInRow: 1.5, emoji: '🍋' },      // было 6→3, было 3→1.5
    { symbol: 'persik', payout: 4, threeInRow: 2, emoji: '🍑' },       // было 8→4, было 4→2
    { symbol: 'grape', payout: 6, threeInRow: 3, emoji: '🍇' },        // было 12→6, было 6→3
    { symbol: 'bell', payout: 9, threeInRow: 4.5, emoji: '🔔' },       // было 18→9, было 9→4.5
    { symbol: 'diamond', payout: 15, threeInRow: 7.5, emoji: '💎' },   // было 30→15, было 15→7.5
    { symbol: 'star', payout: 25, threeInRow: 12.5, emoji: '⭐' },     // было 50→25, было 25→12.5
    { symbol: 'jackpot', payout: 50, threeInRow: 25, emoji: '🎰' }     // было 100→50, было 50→25
  ];
  
  return (
    <div className="slot-controls">
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
              🤖 АВТОИГРА АКТИВНА ({autoplayRemaining} осталось)
            </span>
          ) : (
            <span className="spin-text">
              🎰 КРУТИТЬ ({betAmount} USDT)
            </span>
          )}
        </button>
      </div>
      
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
        
        {/* Быстрые ставки */}
        <div className="quick-bets">
          <button 
            onClick={() => handleQuickBet(0.01)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn large"
          >
            1% ({(balance * 0.01).toFixed(2)} USDT)
          </button>
          <button 
            onClick={() => handleQuickBet(0.05)} 
            disabled={isSpinning || loading || autoplay}
            className="quick-bet-btn large"
          >
            5% ({(balance * 0.05).toFixed(2)} USDT)
          </button>
        </div>
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
              onClick={handleStopAutoplay}
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
        
        {autoplay && autoplayRemaining > 0 && (
          <div className="autoplay-status">
            <span>Осталось спинов: {autoplayRemaining}</span>
          </div>
        )}
      </div>
      
      {/* Таблица выплат с обновленными коэффициентами */}
      <div className="payout-table">
        <h4>Таблица выплат</h4>
        <div className="payout-rules">
          <div className="payout-rule">
            <span className="rule-text">3 в ряд (горизонталь/диагональ)</span>
            <span className="rule-multiplier">×(половина коэффициента)</span>
          </div>
          <div className="payout-rule">
            <span className="rule-text">4 в ряд (горизонталь/диагональ)</span>
            <span className="rule-multiplier">×(полный коэффициент)</span>
          </div>
        </div>
        <div className="payout-grid">
          {slotSymbols.map((symbolData, index) => (
            <div key={index} className="payout-item">
              <span className="payout-symbol">{symbolData.emoji}</span>
              <span className="payout-multiplier">4×{symbolData.payout} | 3×{symbolData.threeInRow}</span>
            </div>
          ))}
        </div>
        <div className="payout-note">
          * Выигрышные линии: горизонтальные (строки) и диагональные
          <br />
          * Первое число - выигрыш за 4 в ряд, второе - за 3 в ряд
          <br />
          * Коэффициенты урезаны для более сбалансированной игры
        </div>
      </div>
      
      {/* Статистика */}
      {gameStats && (
        <div className="game-stats">
          <h4>Ваша статистика</h4>
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-label">Всего игр:</span>
              <span className="stat-value">{gameStats.totalGames}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Победы:</span>
              <span className="stat-value">{gameStats.winCount} ({(gameStats.winRate * 100).toFixed(1)}%)</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Ставки:</span>
              <span className="stat-value">{gameStats.totalBet?.toFixed(2) || 0} USDT</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Выигрыши:</span>
              <span className="stat-value">{gameStats.totalWin?.toFixed(2) || 0} USDT</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Профит:</span>
              <span className={`stat-value ${(gameStats.totalWin - gameStats.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
                {((gameStats.totalWin || 0) - (gameStats.totalLoss || 0)).toFixed(2)} USDT
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotControls;
