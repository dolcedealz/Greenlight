// frontend/src/components/games/coin/CoinGame.js
import React, { useState, useEffect } from 'react';
import { CoinFlip } from './index';
import { CoinControls } from './index';
import { gameApi } from '../../../services';
import '../../../styles/CoinGame.css';

const CoinGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError,
  onFlip,
  isFlipping,
  result,
  lastResults,
  onAnimationEnd
}) => {
  // НОВОЕ: Состояние загрузки
  const [isInitializing, setIsInitializing] = useState(true);
  
  // НОВОЕ: Инициализация с загрузочным экраном
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Показываем загрузочный экран минимум 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИГРЫ МОНЕТКА ===');
        setIsInitializing(false);
        
      } catch (err) {
        console.error('Ошибка инициализации монетки:', err);
        setError('Ошибка загрузки игры');
        setIsInitializing(false);
      }
    };
    
    initializeGame();
  }, [setError]);
  
  // НОВОЕ: Загрузочный экран для монетки
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
              <div className="coin-demo-side coin-demo-heads">O</div>
              <div className="coin-demo-side coin-demo-tails">P</div>
            </div>
          </div>
          
          <div className="vs-container-demo">
            <div className="side-option-demo">
              <div className="side-emoji-demo">O</div>
              <div className="side-label-demo">Орёл</div>
            </div>
            <div className="vs-text-demo">VS</div>
            <div className="side-option-demo">
              <div className="side-emoji-demo">P</div>
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
      <CoinFlip 
        flipping={isFlipping}
        result={result}
        onAnimationEnd={onAnimationEnd}
      />
      
      <CoinControls 
        onFlip={onFlip}
        isFlipping={isFlipping}
        balance={balance}
        lastResults={lastResults}
      />
    </div>
  );
};

export default CoinGame;
