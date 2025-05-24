// frontend/src/components/games/crash/CrashControls.js
import React from 'react';
import '../../../styles/CrashControls.css';

const CrashControls = ({
  betAmount,
  setBetAmount,
  autoCashOut,
  setAutoCashOut,
  onPlaceBet,
  onCashOut,
  balance,
  gameState,
  hasBet,
  cashedOut,
  userBet,
  loading,
  currentMultiplier
}) => {
  
  // Обработчик изменения ставки
  const handleBetAmountChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    if (value >= 0 && value <= balance) {
      setBetAmount(value);
    }
  };
  
  // Обработчик изменения автовывода
  const handleAutoCashOutChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    if (value >= 1.01) {
      setAutoCashOut(value);
    }
  };
  
  // Быстрые ставки
  const handleQuickBet = (multiplier) => {
    const quickBet = Math.min(balance, Math.max(0.1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Быстрые значения автовывода
  const handleQuickAutoCashOut = (value) => {
    setAutoCashOut(value);
  };
  
  // Получение потенциального выигрыша
  const getPotentialWin = () => {
    if (gameState === 'flying' && hasBet && !cashedOut) {
      return (userBet.amount * currentMultiplier).toFixed(2);
    }
    return (betAmount * autoCashOut).toFixed(2);
  };
  
  // Статус кнопки
  const getButtonStatus = () => {
    if (loading) return { text: 'Загрузка...', disabled: true, className: 'loading' };
    
    if (gameState === 'waiting') {
      if (hasBet) {
        return { 
          text: `Ставка ${userBet?.amount} USDT размещена`, 
          disabled: true, 
          className: 'placed' 
        };
      }
      return { 
        text: betAmount > 0 ? `Поставить ${betAmount} USDT` : 'Введите ставку', 
        disabled: betAmount <= 0 || betAmount > balance, 
        className: 'bet' 
      };
    }
    
    if (gameState === 'flying') {
      if (hasBet && !cashedOut) {
        return { 
          text: `Забрать ${getPotentialWin()} USDT`, 
          disabled: false, 
          className: 'cashout' 
        };
      }
      return { 
        text: 'Раунд идет', 
        disabled: true, 
        className: 'disabled' 
      };
    }
    
    if (gameState === 'crashed') {
      if (hasBet && cashedOut) {
        return { 
          text: `Выиграли ${userBet?.winAmount?.toFixed(2)} USDT`, 
          disabled: true, 
          className: 'won' 
        };
      }
      if (hasBet && !cashedOut) {
        return { 
          text: `Проиграли ${userBet?.amount} USDT`, 
          disabled: true, 
          className: 'lost' 
        };
      }
      return { 
        text: 'Ждите следующий раунд', 
        disabled: true, 
        className: 'waiting' 
      };
    }
    
    return { text: 'Ждите...', disabled: true, className: 'disabled' };
  };
  
  const buttonStatus = getButtonStatus();
  
  return (
    <div className="crash-controls">
      <div className="controls-row">
        {/* Левая панель - Ставка */}
        <div className="control-panel bet-panel">
          <div className="panel-header">
            <span className="panel-title">Ставка</span>
            <span className="balance-info">Баланс: {balance.toFixed(2)} USDT</span>
          </div>
          
          <div className="input-group">
            <input
              type="number"
              min="0.1"
              max={balance}
              step="0.1"
              value={betAmount}
              onChange={handleBetAmountChange}
              disabled={gameState !== 'waiting' || hasBet || loading}
              className="amount-input"
              placeholder="0.00"
            />
            <span className="input-suffix">USDT</span>
          </div>
          
          <div className="quick-buttons">
            <button 
              onClick={() => handleQuickBet(0.1)} 
              disabled={gameState !== 'waiting' || hasBet || loading}
              className="quick-btn"
            >
              10%
            </button>
            <button 
              onClick={() => handleQuickBet(0.25)} 
              disabled={gameState !== 'waiting' || hasBet || loading}
              className="quick-btn"
            >
              25%
            </button>
            <button 
              onClick={() => handleQuickBet(0.5)} 
              disabled={gameState !== 'waiting' || hasBet || loading}
              className="quick-btn"
            >
              50%
            </button>
            <button 
              onClick={() => handleQuickBet(1)} 
              disabled={gameState !== 'waiting' || hasBet || loading}
              className="quick-btn"
            >
              MAX
            </button>
          </div>
        </div>
        
        {/* Правая панель - Автовывод */}
        <div className="control-panel auto-panel">
          <div className="panel-header">
            <span className="panel-title">Автовывод</span>
            <span className="potential-win">Выигрыш: {getPotentialWin()} USDT</span>
          </div>
          
          <div className="input-group">
            <input
              type="number"
              min="1.01"
              step="0.01"
              value={autoCashOut}
              onChange={handleAutoCashOutChange}
              disabled={gameState === 'flying' && hasBet}
              className="multiplier-input"
              placeholder="2.00"
            />
            <span className="input-suffix">x</span>
          </div>
          
          <div className="quick-buttons">
            <button 
              onClick={() => handleQuickAutoCashOut(1.5)} 
              disabled={gameState === 'flying' && hasBet}
              className="quick-btn"
            >
              1.5x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(2)} 
              disabled={gameState === 'flying' && hasBet}
              className="quick-btn"
            >
              2x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(5)} 
              disabled={gameState === 'flying' && hasBet}
              className="quick-btn"
            >
              5x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(10)} 
              disabled={gameState === 'flying' && hasBet}
              className="quick-btn"
            >
              10x
            </button>
          </div>
        </div>
      </div>
      
      {/* Основная кнопка действия */}
      <button
        onClick={gameState === 'waiting' ? onPlaceBet : onCashOut}
        disabled={buttonStatus.disabled}
        className={`main-action-btn ${buttonStatus.className}`}
      >
        {buttonStatus.text}
      </button>
      
      {/* Информация о текущей ставке */}
      {hasBet && userBet && (
        <div className="current-bet-info">
          <div className="bet-info-row">
            <span>Ваша ставка:</span>
            <span className="bet-amount">{userBet.amount} USDT</span>
          </div>
          {gameState === 'flying' && !cashedOut && (
            <div className="bet-info-row">
              <span>Текущий выигрыш:</span>
              <span className="current-win">{getPotentialWin()} USDT</span>
            </div>
          )}
          {userBet.autoCashOut > 0 && (
            <div className="bet-info-row">
              <span>Автовывод:</span>
              <span className="auto-cashout">{userBet.autoCashOut}x</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrashControls;