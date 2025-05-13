// GameScreen.js (обновленный с API)
import React, { useState, useEffect } from 'react';
import { CoinFlip, CoinControls } from '../components/games/coin';
import { Header } from '../components/layout';
import { userApi, gameApi } from '../services';
import '../styles/GameScreen.css';

const GameScreen = ({ gameType, userData, onBack }) => {
  const [balance, setBalance] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [lastResults, setLastResults] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Загрузка баланса и истории игр при монтировании
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Загрузка баланса
        const balanceResponse = await userApi.getBalance();
        setBalance(balanceResponse.data.data.balance);
        
        // Загрузка истории игр для текущего типа игры
        const historyResponse = await gameApi.getGameHistory({
          gameType: 'coin',
          limit: 10
        });
        
        // Обрабатываем историю игр
        if (historyResponse.data.data.games && historyResponse.data.data.games.length > 0) {
          const results = historyResponse.data.data.games.map(game => 
            game.result.result
          );
          setLastResults(results);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте еще раз.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [gameType]);
  
  // Обработчик подбрасывания монеты
  const handleFlip = async (betData) => {
    try {
      setIsFlipping(true);
      setGameResult(null);
      
      // Запрос к API для игры
      const response = await gameApi.playCoinFlip(
        betData.betAmount,
        betData.selectedSide
      );
      
      const gameData = response.data.data;
      
      // Устанавливаем результат
      setResult(gameData.result);
      
      // Сохраняем результат в истории
      setLastResults(prev => [gameData.result, ...prev].slice(0, 10));
      
      // Устанавливаем результат игры для отображения
      setGameResult({
        win: gameData.win,
        amount: Math.abs(gameData.profit),
        newBalance: gameData.balanceAfter
      });
      
      // Обновляем баланс после показа результата
      setTimeout(() => {
        setBalance(gameData.balanceAfter);
      }, 2000);
    } catch (err) {
      console.error('Ошибка игры:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsFlipping(false);
    }
  };
  
  // Сбрасываем анимацию после завершения
  const handleAnimationEnd = () => {
    setTimeout(() => {
      setIsFlipping(false);
      setError(null);
    }, 1000);
  };
  
  // Рендерим соответствующую игру в зависимости от типа
  const renderGame = () => {
    switch (gameType) {
      case 'coin':
        return (
          <div className="game-container coin-game">
            <CoinFlip 
              flipping={isFlipping} 
              result={result} 
              onAnimationEnd={handleAnimationEnd} 
            />
            <CoinControls 
              onFlip={handleFlip} 
              isFlipping={isFlipping} 
              balance={balance}
              lastResults={lastResults}
            />
            
            {error && (
              <div className="game-error">
                <p>{error}</p>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="game-not-available">
            <p>Выбранная игра "{gameType}" еще в разработке</p>
            <button onClick={onBack}>Вернуться на главную</button>
          </div>
        );
    }
  };
  
  return (
    <div className="game-screen">
      <Header balance={balance} />
      
      {/* Название игры */}
      <div className="game-header">
        <button className="back-button" onClick={onBack}>←</button>
        <h1 className="game-title">
          {gameType === 'coin' ? 'Монетка' : 
           gameType === 'mines' ? 'Мины' : 
           gameType === 'crash' ? 'Краш' : 
           gameType === 'slots' ? 'Слоты' : 'Игра'}
        </h1>
      </div>
      
      {/* Результат игры */}
      {gameResult && (
        <div className={`game-result ${gameResult.win ? 'win' : 'lose'}`}>
          <div className="result-text">
            {gameResult.win ? 'ВЫИГРЫШ!' : 'ПРОИГРЫШ'}
          </div>
          <div className="result-amount">
            {gameResult.win ? '+' : '-'}{gameResult.amount.toFixed(2)} USDT
          </div>
        </div>
      )}
      
      {/* Игровой компонент */}
      {loading ? (
        <div className="game-loading">
          <div className="loader"></div>
          <p>Загрузка...</p>
        </div>
      ) : (
        renderGame()
      )}
    </div>
  );
};

export default GameScreen;