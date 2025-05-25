// frontend/src/components/games/crash/CrashControls.js
import React from 'react';
import '../../../styles/CrashControls.css';

const CrashControls = ({
  betAmount,
  setBetAmount,
  autoCashOut,
  setAutoCashOut,
  balance,
  gameState,
  hasBet,
  cashedOut,
  userBet,
  userCashOutMultiplier,
  loading,
  currentMultiplier
}) => {
  
  // Корректный обработчик изменения ставки
  const handleBetAmountChange = (e) => {
    const inputValue = e.target.value;
    
    // Разрешаем пустое значение для полной очистки поля
    if (inputValue === '') {
      setBetAmount('');
      return;
    }
    
    const value = parseFloat(inputValue);
    // Проверяем, что значение корректное и в пределах баланса
    if (!isNaN(value) && value >= 0 && value <= balance) {
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
  
  // Быстрые значения автовывода
  const handleQuickAutoCashOut = (value) => {
    if (gameState === 'flying' && hasBet) return;
    setAutoCashOut(value);
  };
  
  // Получение потенциального выигрыша
  const getPotentialWin = () => {
    if (gameState === 'flying' && hasBet && !cashedOut) {
      // Если игра идет и у пользователя есть ставка - показываем текущий возможный выигрыш
      return (userBet.amount * currentMultiplier).toFixed(2);
    }
    // Иначе показываем потенциальный выигрыш при автовыводе
    return (betAmount * autoCashOut).toFixed(2);
  };
  
  // Получение текущей прибыли
  const getCurrentProfit = () => {
    if (gameState === 'flying' && hasBet && !cashedOut) {
      return (parseFloat(getPotentialWin()) - userBet.amount).toFixed(2);
    }
    return (parseFloat(getPotentialWin()) - betAmount).toFixed(2);
  };
  
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
            <span className="panel-title">💰 Ставка</span>
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
                ? `Сейчас: ${getPotentialWin()} USDT`
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
      
      {/* Информация о текущей ставке */}
      {hasBet && userBet && (
        <div className="current-bet-info">
          <div className="bet-info-row">
            <span>💰 Ваша ставка:</span>
            <span className="bet-amount">{userBet.amount} USDT</span>
          </div>
          
          {/* Показываем текущий выигрыш только если игра идет и не вывели */}
          {gameState === 'flying' && !cashedOut && (
            <>
              <div className="bet-info-row">
                <span>🚀 Текущий выигрыш:</span>
                <span className="current-win">{getPotentialWin()} USDT</span>
              </div>
              <div className="bet-info-row">
                <span>💎 Прибыль:</span>
                <span className="current-win">+{getCurrentProfit()} USDT</span>
              </div>
              <div className="bet-info-row">
                <span>📈 Рост в реальном времени:</span>
                <span className="current-win">{currentMultiplier.toFixed(2)}x</span>
              </div>
            </>
          )}
          
          {/* Показываем автовывод только если не вывели */}
          {userBet.autoCashOut > 0 && !cashedOut && (
            <div className="bet-info-row">
              <span>🎯 Автовывод при:</span>
              <span className="auto-cashout">{userBet.autoCashOut}x</span>
            </div>
          )}
          
          {/* Показываем информацию о выводе если уже вывели */}
          {cashedOut && userCashOutMultiplier && (
            <>
              <div className="bet-info-row">
                <span>✅ Выведено при:</span>
                <span className="auto-cashout">{userCashOutMultiplier.toFixed(2)}x</span>
              </div>
              <div className="bet-info-row">
                <span>💰 Получено:</span>
                <span className="current-win">{(userBet.amount * userCashOutMultiplier).toFixed(2)} USDT</span>
              </div>
              <div className="bet-info-row">
                <span>🎉 Прибыль:</span>
                <span className="current-win">+{(userBet.amount * userCashOutMultiplier - userBet.amount).toFixed(2)} USDT</span>
              </div>
              <div className="bet-info-row">
                <span>📊 Игра продолжается:</span>
                <span className="multiplier-value">{currentMultiplier.toFixed(2)}x</span>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* ИСПРАВЛЕНО: Информация о состоянии игры с уточненными описаниями */}
      <div className="game-state-info">
        <div className="state-indicator">
          <span className="state-label">🎮 Состояние:</span>
          <span className={`state-value ${gameState}`}>
            {gameState === 'waiting' && '⏳ Прием ставок (ровно 7 сек)'}
            {gameState === 'flying' && '🚀 Полет (множитель растет медленнее)'}
            {gameState === 'crashed' && '💥 Краш (новый раунд через 3 сек)'}
          </span>
        </div>
        
        {/* Показываем множитель во время полета */}
        {gameState === 'flying' && (
          <div className="multiplier-info">
            <span className="multiplier-label">🔥 Текущий множитель:</span>
            <span className="multiplier-value">{currentMultiplier.toFixed(2)}x</span>
          </div>
        )}
        
        {/* Дополнительная информация для пользователей без ставок */}
        {gameState === 'flying' && !hasBet && (
          <div className="multiplier-info">
            <span className="multiplier-label">⚠️ Вы наблюдаете:</span>
            <span className="multiplier-value">Ставка не размещена</span>
          </div>
        )}
        
        {/* Информация о продолжении игры после кешаута */}
        {gameState === 'flying' && cashedOut && (
          <div className="multiplier-info">
            <span className="multiplier-label">👀 Наблюдаете за другими:</span>
            <span className="multiplier-value">График продолжает расти</span>
          </div>
        )}
      </div>
      
      {/* НОВОЕ: Индикатор скорости роста с улучшениями */}
      {gameState === 'flying' && (
        <div className="game-state-info">
          <div className="state-indicator">
            <span className="state-label">⚡ Скорость роста:</span>
            <span className="state-value flying">
              {currentMultiplier < 2 ? '🐌 Медленно (безопасно)' : 
               currentMultiplier < 5 ? '🏃 Ускоряется (осторожно)' : 
               currentMultiplier < 10 ? '🚀 Быстро (опасно)' : '⚡ Очень быстро (РИСК!)'}
            </span>
          </div>
        </div>
      )}
      
      {/* НОВОЕ: Подсказки для новых игроков */}
      {gameState === 'waiting' && !hasBet && (
        <div className="game-state-info">
          <div className="state-indicator">
            <span className="state-label">💡 Подсказка:</span>
            <span className="state-value">
              Игра замедлена для лучшего опыта. Множитель растет плавнее!
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrashControls;
