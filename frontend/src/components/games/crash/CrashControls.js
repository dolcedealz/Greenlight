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
    if (gameState !== 'waiting' || hasBet || loading) return;
    
    const quickBet = Math.min(balance, Math.max(0.1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Быстрые значения автовывода (ОБНОВЛЕНО для быстрой игры)
  const handleQuickAutoCashOut = (value) => {
    if (gameState === 'flying' && hasBet) return;
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
    if (loading) {
      return { 
        text: 'Загрузка...', 
        disabled: true, 
        className: 'loading' 
      };
    }
    
    if (gameState === 'waiting') {
      if (hasBet) {
        return { 
          text: `Ставка ${userBet?.amount} USDT размещена`, 
          disabled: true, 
          className: 'placed' 
        };
      }
      
      if (betAmount <= 0) {
        return { 
          text: 'Введите ставку', 
          disabled: true, 
          className: 'disabled' 
        };
      }
      
      if (betAmount > balance) {
        return { 
          text: 'Недостаточно средств', 
          disabled: true, 
          className: 'disabled' 
        };
      }
      
      return { 
        text: `⚡ ПОСТАВИТЬ ${betAmount} USDT`, 
        disabled: false, 
        className: 'bet' 
      };
    }
    
    if (gameState === 'flying') {
      if (hasBet && !cashedOut) {
        const winAmount = (userBet.amount * currentMultiplier).toFixed(2);
        return { 
          text: `🚀 ЗАБРАТЬ ${winAmount} USDT`, 
          disabled: false, 
          className: 'cashout' 
        };
      }
      return { 
        text: '🔥 Раунд идет...', 
        disabled: true, 
        className: 'disabled' 
      };
    }
    
    if (gameState === 'crashed') {
      if (hasBet && cashedOut) {
        const winAmount = userBet?.winAmount?.toFixed(2) || '0.00';
        return { 
          text: `✅ Выиграли ${winAmount} USDT`, 
          disabled: true, 
          className: 'won' 
        };
      }
      if (hasBet && !cashedOut) {
        return { 
          text: `💥 Проиграли ${userBet?.amount || 0} USDT`, 
          disabled: true, 
          className: 'lost' 
        };
      }
      return { 
        text: '⏳ Новый раунд скоро...', 
        disabled: true, 
        className: 'waiting' 
      };
    }
    
    return { 
      text: 'Ждите...', 
      disabled: true, 
      className: 'disabled' 
    };
  };
  
  const buttonStatus = getButtonStatus();
  
  // Можно ли изменять ставку
  const canEditBet = gameState === 'waiting' && !hasBet && !loading;
  
  // Можно ли изменять автовывод
  const canEditAutoCashOut = (gameState === 'waiting' || gameState === 'crashed') && !loading;
  
  return (
    <div className="crash-controls">
      <div className="controls-row">
        {/* Левая панель - Ставка */}
        <div className="control-panel bet-panel">
          <div className="panel-header">
            <span className="panel-title">⚡ Ставка</span>
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
              disabled={!canEditBet}
              className="amount-input"
              placeholder="0.00"
            />
            <span className="input-suffix">USDT</span>
          </div>
          
          <div className="quick-buttons">
            <button 
              onClick={() => handleQuickBet(0.1)} 
              disabled={!canEditBet}
              className="quick-btn"
            >
              10%
            </button>
            <button 
              onClick={() => handleQuickBet(0.25)} 
              disabled={!canEditBet}
              className="quick-btn"
            >
              25%
            </button>
            <button 
              onClick={() => handleQuickBet(0.5)} 
              disabled={!canEditBet}
              className="quick-btn"
            >
              50%
            </button>
            <button 
              onClick={() => handleQuickBet(1)} 
              disabled={!canEditBet}
              className="quick-btn"
            >
              MAX
            </button>
          </div>
        </div>
        
        {/* Правая панель - Автовывод */}
        <div className="control-panel auto-panel">
          <div className="panel-header">
            <span className="panel-title">🎯 Автовывод</span>
            <span className="potential-win">
              {gameState === 'flying' && hasBet && !cashedOut 
                ? `Текущий: ${getPotentialWin()} USDT`
                : `При ${autoCashOut}x: ${getPotentialWin()} USDT`
              }
            </span>
          </div>
          
          <div className="input-group">
            <input
              type="number"
              min="1.01"
              step="0.01"
              value={autoCashOut}
              onChange={handleAutoCashOutChange}
              disabled={!canEditAutoCashOut}
              className="multiplier-input"
              placeholder="2.00"
            />
            <span className="input-suffix">x</span>
          </div>
          
          <div className="quick-buttons">
            <button 
              onClick={() => handleQuickAutoCashOut(1.25)} 
              disabled={!canEditAutoCashOut}
              className="quick-btn"
            >
              1.25x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(1.5)} 
              disabled={!canEditAutoCashOut}
              className="quick-btn"
            >
              1.5x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(2)} 
              disabled={!canEditAutoCashOut}
              className="quick-btn"
            >
              2x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(3)} 
              disabled={!canEditAutoCashOut}
              className="quick-btn"
            >
              3x
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
            <span>💰 Ваша ставка:</span>
            <span className="bet-amount">{userBet.amount} USDT</span>
          </div>
          
          {gameState === 'flying' && !cashedOut && (
            <div className="bet-info-row">
              <span>🚀 Текущий выигрыш:</span>
              <span className="current-win">{getPotentialWin()} USDT</span>
            </div>
          )}
          
          {gameState === 'flying' && !cashedOut && (
            <div className="bet-info-row">
              <span>💎 Прибыль:</span>
              <span className="current-win">
                +{(parseFloat(getPotentialWin()) - userBet.amount).toFixed(2)} USDT
              </span>
            </div>
          )}
          
          {userBet.autoCashOut > 0 && !cashedOut && (
            <div className="bet-info-row">
              <span>🎯 Автовывод при:</span>
              <span className="auto-cashout">{userBet.autoCashOut}x</span>
            </div>
          )}
          
          {cashedOut && (
            <div className="bet-info-row">
              <span>✅ Выведено при:</span>
              <span className="auto-cashout">{currentMultiplier.toFixed(2)}x</span>
            </div>
          )}
        </div>
      )}
      
      {/* Информация о состоянии игры */}
      <div className="game-state-info">
        <div className="state-indicator">
          <span className="state-label">Состояние:</span>
          <span className={`state-value ${gameState}`}>
            {gameState === 'waiting' && '⏳ Прием ставок (5 сек)'}
            {gameState === 'flying' && '🚀 Быстрый полет'}
            {gameState === 'crashed' && '💥 Краш (2 сек до нового)'}
          </span>
        </div>
        
        {gameState === 'flying' && (
          <div className="multiplier-info">
            <span className="multiplier-label">🔥 Множитель:</span>
            <span className="multiplier-value">{currentMultiplier.toFixed(2)}x</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrashControls;
