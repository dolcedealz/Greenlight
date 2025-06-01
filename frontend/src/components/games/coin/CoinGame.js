// frontend/src/components/games/coin/CoinGame.js
import React, { useState, useEffect } from 'react';
import CoinFlip from './CoinFlip';
import CoinControls from './CoinControls';
import { gameApi } from '../../../services';
import '../../../styles/CoinGame.css';

const CoinGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError,
  onFlip, // ИСПРАВЛЕНО: принимаем onFlip из GameScreen
  isFlipping, // ИСПРАВЛЕНО: принимаем isFlipping из GameScreen
  result, // ИСПРАВЛЕНО: принимаем result из GameScreen
  lastResults, // ИСПРАВЛЕНО: принимаем lastResults из GameScreen
  onAnimationEnd // ИСПРАВЛЕНО: принимаем onAnimationEnd из GameScreen
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [gameResultData, setGameResultData] = useState(null);
  
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИГРЫ МОНЕТКА ===');
        
        // Показываем загрузочный экран минимум 1.5 секунды
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
  
  // ИСПРАВЛЕННЫЙ обработчик игры - теперь используется переданный onFlip
  const handleFlip = async (betData) => {
    console.log('🪙 COIN GAME: Получен запрос на подбрасывание:', betData);
    
    if (loading || isFlipping) {
      console.log('🪙 COIN GAME: Блокировано - уже идет игра или загрузка');
      return;
    }
    
    if (!onFlip) {
      console.error('🪙 COIN GAME: Ошибка - функция onFlip не передана из GameScreen!');
      setError('Ошибка конфигурации игры');
      return;
    }
    
    console.log('🪙 COIN GAME: Передаем запрос в GameScreen через onFlip');
    
    try {
      setLoading(true);
      setError(null);
      
      // Вызываем обработчик из GameScreen
      await onFlip(betData);
      
    } catch (err) {
      console.error('🪙 COIN GAME: Ошибка при обработке:', err);
      setError(err.message || 'Произошла ошибка при игре');
    } finally {
      setLoading(false);
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
          onAnimationEnd={onAnimationEnd}
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
      
      {/* ИСПРАВЛЕНО: Управление игрой - передаем правильный обработчик */}
      <CoinControls 
        onFlip={handleFlip} // ИСПРАВЛЕНО: передаем наш локальный обработчик
        isFlipping={loading || isFlipping} // ИСПРАВЛЕНО: учитываем и loading и isFlipping
        balance={balance}
        lastResults={lastResults || []} // ИСПРАВЛЕНО: передаем lastResults или пустой массив
      />
    </div>
  );
};

export default CoinGame;
