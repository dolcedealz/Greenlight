// frontend/src/screens/GameScreen.js (обновленный)
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
  const [gameStats, setGameStats] = useState(null);
  
  // Загрузка баланса, истории игр и статистики при монтировании
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
        
        // Загружаем статистику игр
        const statsResponse = await gameApi.getGameStats();
        if (statsResponse.data.data.byGameType && statsResponse.data.data.byGameType.coin) {
          setGameStats(statsResponse.data.data.byGameType.coin);
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
        betData.selectedSide,
        betData.clientSeed
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
        newBalance: gameData.balanceAfter,
        serverSeedHashed: gameData.serverSeedHashed,
        clientSeed: gameData.clientSeed,
        nonce: gameData.nonce
      });
      
      // Обновляем баланс после показа результата
      setTimeout(() => {
        setBalance(gameData.balanceAfter);
        
        // Обновляем статистику
        if (gameStats) {
          const updatedStats = { ...gameStats };
          updatedStats.totalGames += 1;
          updatedStats.totalBet += betData.betAmount;
          
          if (gameData.win) {
            updatedStats.winCount += 1;
            updatedStats.totalWin += gameData.profit;
          } else {
            updatedStats.totalLoss += betData.betAmount;
          }
          
          updatedStats.winRate = updatedStats.winCount / updatedStats.totalGames;
          setGameStats(updatedStats);
        }
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
            
            {gameStats && (
              <div className="game-stats">
                <h3>Ваша статистика</h3>
                <div className="stats-container">
                  <div className="stat-item">
                    <span className="stat-label">Всего игр:</span>
                    <span className="stat-value">{gameStats.totalGames}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Победы:</span>
                    <span className="stat-value">{gameStats.winCount} ({(gameStats.winRate * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Ставки:</span>
                    <span className="stat-value">{gameStats.totalBet.toFixed(2)} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Выигрыши:</span>
                    <span className="stat-value">{gameStats.totalWin.toFixed(2)} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Профит:</span>
                    <span className={`stat-value ${gameStats.totalWin - gameStats.totalLoss >= 0 ? 'positive' : 'negative'}`}>
                      {(gameStats.totalWin - gameStats.totalLoss).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
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
          {gameResult.serverSeedHashed && (
            <div className="result-verification">
              <div className="verification-item">
                <span>Server Seed Hash:</span> 
                <span className="hash">{gameResult.serverSeedHashed.slice(0, 10)}...{gameResult.serverSeedHashed.slice(-10)}</span>
              </div>
              <div className="verification-item">
                <span>Client Seed:</span> 
                <span className="hash">{gameResult.clientSeed}</span>
              </div>
              <div className="verification-item">
                <span>Nonce:</span> 
                <span className="hash">{gameResult.nonce}</span>
              </div>
            </div>
          )}
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