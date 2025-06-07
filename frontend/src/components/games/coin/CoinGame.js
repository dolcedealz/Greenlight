// frontend/src/components/games/coin/CoinGame.js - УПРОЩЕННАЯ ВЕРСИЯ
import React, { useState, useEffect } from 'react';
import CoinFlip from './CoinFlip';
import CoinControls from './CoinControls';
import '../../../styles/CoinGame.css';

const CoinGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError,
  onFlip, // Принимаем onFlip из GameScreen
  isFlipping, // Принимаем isFlipping из GameScreen
  result, // Принимаем result из GameScreen
  lastResults, // Принимаем lastResults из GameScreen
  onAnimationComplete // Принимаем onAnimationComplete из GameScreen
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИГРЫ МОНЕТКА ===');
        
        // Показываем загрузочный экран 1.5 секунды
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setIsInitializing(false);
        console.log('Игра монетка готова');
        
      } catch (err) {
        console.error('Ошибка инициализации монетки:', err);
        setError('Ошибка загрузки игры');
        setIsInitializing(false);
      }
    };
    
    initializeGame();
  }, [setError]);
  
  // Простой обработчик игры - просто передаем запрос в GameScreen
  const handleFlip = async (betData) => {
    console.log('🪙 COIN GAME: Получен запрос на подбрасывание:', betData);
    
    if (!onFlip) {
      console.error('🪙 COIN GAME: Ошибка - функция onFlip не передана из GameScreen!');
      setError('Ошибка конфигурации игры');
      return;
    }
    
    try {
      setError(null);
      
      // Просто вызываем обработчик из GameScreen
      await onFlip(betData);
      
    } catch (err) {
      console.error('🪙 COIN GAME: Ошибка при обработке:', err);
      setError(err.message || 'Произошла ошибка при игре');
    }
  };
  
  // Загрузочный экран
  if (isInitializing) {
    return (
      <div className="coin-loading-screen">
        <div className="coin-loading-content">
          <div className="greenlight-logo">
            <div className="logo-icon coin-icon">🪙</div>
            <div className="logo-text">Greenlight</div>
            <div className="logo-subtitle">Coin Flip</div>
          </div>
          
          <div className="coin-demo-container">
            <div className="coin-demo">
              <div className="coin-demo-side coin-demo-heads">
                <span>₿</span>
              </div>
              <div className="coin-demo-side coin-demo-tails">
                <span>💎</span>
              </div>
            </div>
          </div>
          
          <div className="vs-container-demo">
            <div className="side-option-demo">
              <div className="side-emoji-demo">₿</div>
              <div className="side-label-demo">Орёл</div>
            </div>
            <div className="vs-text-demo">VS</div>
            <div className="side-option-demo">
              <div className="side-emoji-demo">💎</div>
              <div className="side-label-demo">Решка</div>
            </div>
          </div>
          
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <div className="loading-text">Подготовка монеты...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="coin-game">
      {/* Главная игровая область */}
      <div className="coin-main-area">
        <CoinFlip 
          flipping={isFlipping}
          result={result}
          onAnimationComplete={onAnimationComplete}
        />
        
        {/* История результатов */}
        <div className="results-section">
          <div className="results-header">
            <h3>Последние результаты</h3>
          </div>
          
          <div className="results-container">
            {(!lastResults || lastResults.length === 0) ? (
              <div className="no-results">
                <span className="no-results-icon">🎯</span>
                <span className="no-results-text">История пуста</span>
              </div>
            ) : (
              <div className="results-list">
                {lastResults.slice().reverse().map((result, index) => (
                  <div 
                    key={index} 
                    className={`result-item ${result}`}
                    title={result === 'heads' ? 'Орёл' : 'Решка'}
                  >
                    <span className="result-icon">
                      {result === 'heads' ? '₿' : '💎'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Управление игрой */}
      <CoinControls 
        onFlip={handleFlip}
        isFlipping={isFlipping}
        balance={balance}
        lastResults={lastResults || []}
      />
    </div>
  );
};

export default CoinGame;
