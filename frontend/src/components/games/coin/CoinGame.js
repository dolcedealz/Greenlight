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
  setError 
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [lastResults, setLastResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gameResultData, setGameResultData] = useState(null); // Сохраняем данные игры
  
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИГРЫ МОНЕТКА ===');
        
        // Загружаем сохраненную историю из localStorage
        const savedResults = localStorage.getItem('coinGameResults');
        
        if (savedResults) {
          try {
            const parsedResults = JSON.parse(savedResults);
            setLastResults(parsedResults);
          } catch (e) {
            console.error('Ошибка загрузки истории:', e);
            setLastResults([]);
          }
        }
        
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
  
  // Функция для управления историей - УБРАНА ОЧИСТКА
  const manageHistory = (newResult) => {
    let updatedResults = [...lastResults, newResult];
    
    // УБРАНО: Логика очистки истории каждые 8 игр
    
    // Сохраняем в localStorage
    localStorage.setItem('coinGameResults', JSON.stringify(updatedResults));
    
    setLastResults(updatedResults);
  };
  
  // Обработчик игры
  const handleFlip = async (betData) => {
    if (loading || isFlipping) return;
    
    try {
      setLoading(true);
      setIsFlipping(true);
      setGameResult(null);
      setError(null);
      setResult(null);
      setGameResultData(null); // Сбрасываем предыдущие данные
      
      console.log('🪙 МОНЕТКА: Начинаем игру', betData);
      
      // Запрос к API
      const response = await gameApi.playCoinFlip(
        betData.betAmount,
        betData.selectedSide
      );
      
      const gameData = response.data.data;
      console.log('🪙 МОНЕТКА: Результат с сервера:', gameData);
      
      // Сохраняем данные игры, но не показываем результат сразу
      setGameResultData(gameData);
      
      // Устанавливаем результат для анимации
      setResult(gameData.result);
      
      // ИСПРАВЛЕНО: НЕ добавляем в историю сразу - ждем завершения анимации
      // Управляем историей только после завершения анимации
      
      // Обновляем баланс
      if (gameData.balanceAfter !== undefined) {
        setBalance(gameData.balanceAfter);
      }
      
      // НЕ устанавливаем результат сразу - ждем завершения анимации
      
    } catch (err) {
      console.error('🪙 МОНЕТКА: Ошибка игры:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsFlipping(false);
      setLoading(false);
    }
  };
  
  // Обработчик завершения анимации
  const handleAnimationEnd = () => {
    console.log('🪙 МОНЕТКА: Анимация завершена');
    setIsFlipping(false);
    setLoading(false);
    
    // Показываем результат игры
    if (gameResultData) {
      console.log('🪙 МОНЕТКА: Показываем результат:', gameResultData);
      
      // ИСПРАВЛЕНО: Добавляем в историю только после завершения анимации
      manageHistory(gameResultData.result);
      
      setGameResult({
        win: gameResultData.win,
        amount: Math.abs(gameResultData.profit),
        newBalance: gameResultData.balanceAfter,
        multiplier: gameResultData.multiplier
      });
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
          onAnimationEnd={handleAnimationEnd}
        />
        
        {/* История результатов - УБРАНО ОТОБРАЖЕНИЕ СЧЕТЧИКА ОЧИСТКИ */}
        <div className="results-section">
          <div className="results-header">
            <h3>Последние результаты</h3>
          </div>
          
          <div className="results-container">
            {lastResults.length === 0 ? (
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
        isFlipping={loading || isFlipping}
        balance={balance}
        lastResults={lastResults}
      />
    </div>
  );
};

export default CoinGame;
