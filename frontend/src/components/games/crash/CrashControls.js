// frontend/src/components/games/crash/CrashControls.js
import React from 'react';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import '../../../styles/CrashControls.css';

const CrashControls = ({
  betAmount,
  setBetAmount,
  autoCashOut,
  setAutoCashOut,
  autoCashOutEnabled,
  setAutoCashOutEnabled,
  balance,
  gameState,
  hasBet,
  cashedOut,
  userBet,
  userCashOutMultiplier,
  loading,
  currentMultiplier,
  autoWithdrawn = false,
  isApproachingAutoCashOut = false
}) => {
  
  const { 
    buttonPressFeedback, 
    selectionChanged, 
    gameActionFeedback, 
    importantActionFeedback 
  } = useTactileFeedback();
  
  // Корректный обработчик изменения ставки
  const handleBetAmountChange = (e) => {
    const inputValue = e.target.value;
    
    if (inputValue === '') {
      setBetAmount('');
      return;
    }
    
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 0 && value <= balance) {
      setBetAmount(value);
      buttonPressFeedback();
    }
  };
  
  // Обработчик изменения автовывода
  const handleAutoCashOutChange = (e) => {
    const inputValue = e.target.value;
    
    if (inputValue === '') {
      setAutoCashOut('');
      return;
    }
    
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 1.01 && value <= 1000) {
      setAutoCashOut(value);
      buttonPressFeedback();
    }
  };
  
  // Быстрые ставки
  const handleQuickBet = (multiplier) => {
    if (gameState !== 'waiting' || hasBet || loading) return;
    
    buttonPressFeedback();
    const quickBet = Math.min(balance, Math.max(0.1, Math.floor(balance * multiplier * 100) / 100));
    setBetAmount(quickBet);
  };
  
  // Быстрые значения автовывода
  const handleQuickAutoCashOut = (value) => {
    if (gameState === 'flying' && hasBet) return;
    
    selectionChanged();
    setAutoCashOut(value);
  };
  
  // УЛУЧШЕННАЯ функция получения потенциального выигрыша с учетом автовывода
  const getPotentialWin = () => {
    if (gameState === 'flying' && hasBet) {
      if (cashedOut && userCashOutMultiplier > 0) {
        // Если уже вывели, показываем финальную сумму
        return (userBet.amount * userCashOutMultiplier).toFixed(2);
      }
      // Если еще не вывели - показываем текущий возможный выигрыш
      return (userBet.amount * currentMultiplier).toFixed(2);
    }
    // ИСПРАВЛЕНИЕ: Учитываем включен ли автовывод
    if (autoCashOutEnabled && autoCashOut > 0) {
      return (betAmount * autoCashOut).toFixed(2);
    } else {
      // Если автовывод выключен, показываем ручной режим
      return '???.??';
    }
  };
  
  // УЛУЧШЕННАЯ функция получения текущей прибыли
  const getCurrentProfit = () => {
    if (gameState === 'flying' && hasBet) {
      if (cashedOut && userCashOutMultiplier > 0) {
        // Если уже вывели, показываем финальную прибыль
        return ((userBet.amount * userCashOutMultiplier) - userBet.amount).toFixed(2);
      }
      // Если еще не вывели - показываем текущую прибыль
      return (parseFloat(getPotentialWin()) - userBet.amount).toFixed(2);
    }
    
    // ИСПРАВЛЕНИЕ: Учитываем включен ли автовывод
    if (autoCashOutEnabled && autoCashOut > 0) {
      return (parseFloat(getPotentialWin()) - betAmount).toFixed(2);
    } else {
      return '???.??';
    }
  };
  
  // Можно ли изменять ставку
  const canEditBet = gameState === 'waiting' && !hasBet && !loading;
  
  // Можно ли изменять автовывод
  const canEditAutoCashOut = (gameState === 'waiting' || gameState === 'crashed') && !loading;
  
  // НОВАЯ функция: Получение статуса автовывода для отображения
  const getAutoCashOutStatus = () => {
    if (!autoCashOutEnabled) {
      return 'Ручной режим - нажимайте "Вывести"';
    }
    
    if (gameState === 'flying' && hasBet) {
      if (cashedOut) {
        if (autoWithdrawn) {
          return `✅ Автовыведено при ${userCashOutMultiplier.toFixed(2)}x`;
        } else {
          return `✅ Выведено при ${userCashOutMultiplier.toFixed(2)}x`;
        }
      } else {
        if (isApproachingAutoCashOut && userBet && userBet.autoCashOut > 0) {
          return `⚡ Скоро автовывод при ${userBet.autoCashOut}x!`;
        } else if (userBet && userBet.autoCashOut > 0) {
          return `🎯 Автовывод при ${userBet.autoCashOut}x`;
        } else {
          return `Текущий выигрыш: ${getPotentialWin()} USDT`;
        }
      }
    }
    
    if (autoCashOut > 0) {
      return `При ${autoCashOut}x: ${getPotentialWin()} USDT`;
    }
    
    return 'Установите множитель автовывода';
  };
  
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
            <div className="auto-header-row">
              <span className="panel-title">🎯 Автовывод</span>
              <label className="auto-toggle">
                <input
                  type="checkbox"
                  checked={autoCashOutEnabled}
                  onChange={(e) => {
                    setAutoCashOutEnabled(e.target.checked);
                    selectionChanged();
                  }}
                  disabled={gameState === 'flying' && hasBet}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">
                  {autoCashOutEnabled ? 'Вкл' : 'Выкл'}
                </span>
              </label>
            </div>
            <span className="potential-win">
              {getAutoCashOutStatus()}
            </span>
          </div>
          
          <div className={`input-group ${!autoCashOutEnabled ? 'disabled' : ''}`}>
            <input
              type="number"
              min="1.01"
              step="0.01"
              value={autoCashOut}
              onChange={handleAutoCashOutChange}
              disabled={!autoCashOutEnabled || !canEditAutoCashOut}
              className="multiplier-input"
              placeholder="2.00"
            />
            <span className="input-suffix">x</span>
          </div>
          
          <div className="quick-buttons">
            <button 
              onClick={() => handleQuickAutoCashOut(1.25)} 
              disabled={!autoCashOutEnabled || !canEditAutoCashOut}
              className="quick-btn"
            >
              1.25x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(1.5)} 
              disabled={!autoCashOutEnabled || !canEditAutoCashOut}
              className="quick-btn"
            >
              1.5x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(2)} 
              disabled={!autoCashOutEnabled || !canEditAutoCashOut}
              className="quick-btn"
            >
              2x
            </button>
            <button 
              onClick={() => handleQuickAutoCashOut(3)} 
              disabled={!autoCashOutEnabled || !canEditAutoCashOut}
              className="quick-btn"
            >
              3x
            </button>
          </div>
        </div>
      </div>
      
      {/* УЛУЧШЕННАЯ информация о текущей ставке */}
      {hasBet && userBet && (
        <div className="current-bet-info">
          <div className="bet-info-row">
            <span>💰 Ваша ставка:</span>
            <span className="bet-amount">{userBet.amount} USDT</span>
          </div>
          
          {/* УЛУЧШЕННАЯ логика отображения текущего выигрыша */}
          {gameState === 'flying' && (
            <>
              {!cashedOut ? (
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
                    <span>📈 Множитель:</span>
                    <span className="current-win">{currentMultiplier.toFixed(2)}x</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="bet-info-row">
                    <span>{autoWithdrawn ? '🤖 Автовыведено:' : '✅ Выведено:'}</span>
                    <span className="current-win">{getPotentialWin()} USDT</span>
                  </div>
                  <div className="bet-info-row">
                    <span>🎉 Прибыль:</span>
                    <span className="current-win">+{getCurrentProfit()} USDT</span>
                  </div>
                  <div className="bet-info-row">
                    <span>📊 При множителе:</span>
                    <span className="current-win">{userCashOutMultiplier.toFixed(2)}x</span>
                  </div>
                  <div className="bet-info-row">
                    <span>📈 Игра продолжается:</span>
                    <span className="multiplier-value">{currentMultiplier.toFixed(2)}x</span>
                  </div>
                </>
              )}
            </>
          )}
          
          {/* УЛУЧШЕННАЯ информация об автовыводе */}
          {!cashedOut && (
            <>
              {autoCashOutEnabled && userBet.autoCashOut > 0 ? (
                <div className="bet-info-row">
                  <span>🎯 Автовывод при:</span>
                  <span className={`auto-cashout ${isApproachingAutoCashOut ? 'approaching' : ''}`}>
                    {userBet.autoCashOut}x
                    {isApproachingAutoCashOut && ' ⚡ Скоро!'}
                  </span>
                </div>
              ) : (
                <div className="bet-info-row">
                  <span>✋ Режим:</span>
                  <span className="manual-mode">Ручной вывод</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* ИСПРАВЛЕННАЯ информация о состоянии игры */}
      <div className="game-state-info">
        <div className="state-indicator">
          <span className="state-label">🎮 Состояние:</span>
          <span className={`state-value ${gameState}`}>
            {gameState === 'waiting' && '⏳ Прием ставок (7 сек)'}
            {gameState === 'flying' && '🚀 Полет (множитель растет)'}
            {gameState === 'crashed' && '💥 Краш (пауза 3 сек)'}
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
            <span className="multiplier-label">⚠️ Статус:</span>
            <span className="multiplier-value">Наблюдение (без ставки)</span>
          </div>
        )}
        
        {/* Информация о продолжении игры после кешаута */}
        {gameState === 'flying' && cashedOut && (
          <div className="multiplier-info">
            <span className="multiplier-label">👀 Наблюдение:</span>
            <span className="multiplier-value">График растет дальше</span>
          </div>
        )}
      </div>
      
      {/* УЛУЧШЕННЫЙ индикатор скорости роста */}
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
              {autoCashOutEnabled ? 
                `Автовывод при ${autoCashOut}x поможет защитить прибыль` :
                'Включите автовывод для защиты от потерь'}
            </span>
          </div>
        </div>
      )}
      
      {/* УЛУЧШЕННОЕ предупреждение о приближении автовывода */}
      {isApproachingAutoCashOut && hasBet && !cashedOut && (
        <div className="game-state-info approaching-auto-info">
          <div className="state-indicator">
            <span className="state-label">⚡ Внимание:</span>
            <span className="state-value approaching">
              Множитель приближается к {userBet.autoCashOut}x! Автовывод скоро сработает!
            </span>
          </div>
        </div>
      )}
      
      {/* НОВОЕ: Информация об успешном автовыводе */}
      {cashedOut && autoWithdrawn && gameState === 'flying' && (
        <div className="game-state-info">
          <div className="state-indicator">
            <span className="state-label">🤖 Автовывод:</span>
            <span className="state-value">
              Сработал автоматически при {userCashOutMultiplier.toFixed(2)}x! 
              Ваши средства в безопасности.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrashControls;
