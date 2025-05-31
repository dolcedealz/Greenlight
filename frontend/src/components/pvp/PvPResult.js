// frontend/src/components/pvp/PvPResult.js
import React, { useState, useEffect } from 'react';
import { useWebApp } from '../../hooks';
import '../../styles/PvPResult.css';

const PvPResult = ({ gameResult, sessionData, onRematch, onClose }) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('coin-flip'); // coin-flip, result, celebration
  const webApp = useWebApp();

  const isWinner = gameResult.winnerId === sessionData?.challengerId || 
                   gameResult.winnerId === sessionData?.opponentId;
  const isCurrentUserWinner = sessionData?.isPlayer && 
    ((sessionData.isChallenger && gameResult.winnerId === sessionData.challengerId) ||
     (!sessionData.isChallenger && gameResult.winnerId === sessionData.opponentId));

  // Анимация результата
  useEffect(() => {
    const sequence = async () => {
      // Фаза 1: Подбрасывание монеты (2 секунды)
      setAnimationPhase('coin-flip');
      
      setTimeout(() => {
        // Фаза 2: Показ результата (1 секунда)
        setAnimationPhase('result');
        
        setTimeout(() => {
          // Фаза 3: Празднование или грусть (3 секунды)
          setAnimationPhase('celebration');
          
          if (isCurrentUserWinner) {
            setShowConfetti(true);
            webApp?.showAlert('🎉 Поздравляем с победой!');
            
            // Вибрация победы
            if (webApp?.HapticFeedback) {
              webApp.HapticFeedback.notificationOccurred('success');
            }
          } else {
            // Вибрация поражения
            if (webApp?.HapticFeedback) {
              webApp.HapticFeedback.notificationOccurred('error');
            }
          }
        }, 1000);
      }, 2000);
    };

    sequence();
  }, [isCurrentUserWinner, webApp]);

  const handleRematch = () => {
    if (onRematch) {
      onRematch();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const getCoinEmoji = () => {
    return gameResult.result === 'heads' ? '🪙' : '🥈';
  };

  const getResultText = () => {
    return gameResult.result === 'heads' ? 'ОРЕЛ' : 'РЕШКА';
  };

  return (
    <div className={`pvp-result ${animationPhase}`}>
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)]
              }}
            />
          ))}
        </div>
      )}

      <div className="result-container">
        {/* Заголовок */}
        <div className="result-header">
          <h1 className={`result-title ${isCurrentUserWinner ? 'winner' : 'loser'}`}>
            {isCurrentUserWinner ? '🏆 ПОБЕДА!' : '💔 ПОРАЖЕНИЕ'}
          </h1>
          {sessionData && (
            <p className="session-info">Сессия: {sessionData.sessionId}</p>
          )}
        </div>

        {/* Анимация монеты */}
        <div className="coin-section">
          <div className={`coin-container ${animationPhase}`}>
            <div className="coin">
              {animationPhase === 'coin-flip' ? (
                <div className="coin-spinning">🪙</div>
              ) : (
                <div className="coin-result">
                  {getCoinEmoji()}
                </div>
              )}
            </div>
          </div>
          
          {animationPhase !== 'coin-flip' && (
            <div className="coin-result-text">
              <h2>{getResultText()}</h2>
            </div>
          )}
        </div>

        {/* Детали результата */}
        {animationPhase === 'celebration' && (
          <>
            <div className="game-details">
              <div className="detail-item">
                <span className="label">🏆 Победитель:</span>
                <span className={`value ${isCurrentUserWinner ? 'highlight' : ''}`}>
                  @{gameResult.winnerUsername}
                </span>
              </div>
              
              <div className="detail-item">
                <span className="label">💰 Выигрыш:</span>
                <span className="value prize">
                  {gameResult.winAmount} USDT
                </span>
              </div>
              
              <div className="detail-item">
                <span className="label">🎲 Результат:</span>
                <span className="value">
                  {getResultText()} ({getCoinEmoji()})
                </span>
              </div>

              <div className="detail-item">
                <span className="label">💸 Комиссия:</span>
                <span className="value">
                  {gameResult.commission} USDT (5%)
                </span>
              </div>
            </div>

            {/* Статистика игроков */}
            <div className="players-result">
              <div className={`player-result ${sessionData?.isChallenger && isCurrentUserWinner ? 'winner' : 
                sessionData?.isChallenger && !isCurrentUserWinner ? 'loser' : ''}`}>
                <div className="player-info">
                  <span className="player-name">@{sessionData?.challengerUsername}</span>
                  <span className="player-side">ОРЕЛ 🪙</span>
                </div>
                <div className="player-outcome">
                  {gameResult.winnerId === sessionData?.challengerId ? (
                    <span className="win">+{gameResult.winAmount} USDT</span>
                  ) : (
                    <span className="loss">-{sessionData?.amount} USDT</span>
                  )}
                </div>
              </div>

              <div className="vs-divider">VS</div>

              <div className={`player-result ${!sessionData?.isChallenger && isCurrentUserWinner ? 'winner' : 
                !sessionData?.isChallenger && !isCurrentUserWinner ? 'loser' : ''}`}>
                <div className="player-info">
                  <span className="player-name">@{sessionData?.opponentUsername}</span>
                  <span className="player-side">РЕШКА 🥈</span>
                </div>
                <div className="player-outcome">
                  {gameResult.winnerId === sessionData?.opponentId ? (
                    <span className="win">+{gameResult.winAmount} USDT</span>
                  ) : (
                    <span className="loss">-{sessionData?.amount} USDT</span>
                  )}
                </div>
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="action-buttons">
              <button 
                className="rematch-button"
                onClick={handleRematch}
              >
                🔄 Реванш
              </button>
              
              <button 
                className="close-button"
                onClick={handleClose}
              >
                ✅ Завершить
              </button>
            </div>

            {/* Сообщение */}
            <div className="result-message">
              {isCurrentUserWinner ? (
                <div className="winner-message">
                  <p>🎉 <strong>Поздравляем с победой!</strong></p>
                  <p>Средства зачислены на ваш баланс</p>
                </div>
              ) : (
                <div className="loser-message">
                  <p>😔 <strong>В этот раз не повезло</strong></p>
                  <p>Попробуйте еще раз - удача может повернуться!</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Индикатор загрузки для анимации */}
        {animationPhase === 'coin-flip' && (
          <div className="loading-message">
            <p>🎲 Подбрасываем монету...</p>
            <div className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          </div>
        )}

        {animationPhase === 'result' && (
          <div className="result-announcement">
            <p>🎯 Результат определен!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PvPResult;