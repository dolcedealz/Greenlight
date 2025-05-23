// frontend/src/screens/GameScreen.js
import React, { useState, useEffect } from 'react';
import { CoinFlip, CoinControls } from '../components/games/coin';
import MinesGame from '../components/games/mines/MinesGame';
import SlotGame from '../components/games/slots/SlotGame'; // Добавляем SlotGame
import { Header } from '../components/layout';
import { userApi, gameApi } from '../services';
import '../styles/GameScreen.css';

const GameScreen = ({ gameType, userData, onBack, onBalanceUpdate, balance, setBalance }) => {
  // For Coin game
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [lastResults, setLastResults] = useState([]);
  
  // Shared between games
  const [gameResult, setGameResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStats, setGameStats] = useState(null);
  
  // Fetch game history and stats on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Load game history for the current game type
        const historyResponse = await gameApi.getGameHistory({
          gameType: gameType,
          limit: 10
        });
        
        // Process game history
        if (historyResponse.data.data.games && historyResponse.data.data.games.length > 0) {
          if (gameType === 'coin') {
            const results = historyResponse.data.data.games.map(game => 
              game.result.result
            );
            setLastResults(results);
          }
        }
        
        // Load game stats
        const statsResponse = await gameApi.getGameStats();
        if (statsResponse.data.data.byGameType && statsResponse.data.data.byGameType[gameType]) {
          setGameStats(statsResponse.data.data.byGameType[gameType]);
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
  
  // Coin game handler
  const handleFlip = async (betData) => {
    try {
      setIsFlipping(true);
      setGameResult(null);
      
      const response = await gameApi.playCoinFlip(
        betData.betAmount,
        betData.selectedSide
      );
      
      const gameData = response.data.data;
      
      setResult(gameData.result);
      setLastResults(prev => [gameData.result, ...prev].slice(0, 10));
      
      setGameResult({
        win: gameData.win,
        amount: Math.abs(gameData.profit),
        newBalance: gameData.balanceAfter
      });
      
      if (gameData.balanceAfter !== undefined) {
        setBalance(gameData.balanceAfter);
      }
      
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
    } catch (err) {
      console.error('Ошибка игры:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsFlipping(false);
    }
  };
  
  const handleAnimationEnd = () => {
    setIsFlipping(false);
    setError(null);
  };
  
  // Render appropriate game based on type
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
                    <span className="stat-value">{gameStats.totalBet?.toFixed(2) || 0} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Выигрыши:</span>
                    <span className="stat-value">{gameStats.totalWin?.toFixed(2) || 0} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Профит:</span>
                    <span className={`stat-value ${(gameStats.totalWin - gameStats.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
                      {((gameStats.totalWin || 0) - (gameStats.totalLoss || 0)).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'mines':
        return (
          <div className="game-container mines-game">
            <MinesGame 
              balance={balance}
              setBalance={setBalance}
              gameStats={gameStats}
              setGameResult={setGameResult}
              setError={setError}
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
                    <span className="stat-value">{gameStats.totalBet?.toFixed(2) || 0} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Выигрыши:</span>
                    <span className="stat-value">{gameStats.totalWin?.toFixed(2) || 0} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Профит:</span>
                    <span className={`stat-value ${(gameStats.totalWin - gameStats.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
                      {((gameStats.totalWin || 0) - (gameStats.totalLoss || 0)).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'slots':
        return (
          <div className="game-container slots-game">
            <SlotGame 
              balance={balance}
              setBalance={setBalance}
              gameStats={gameStats}
              setGameResult={setGameResult}
              setError={setError}
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
                    <span className="stat-value">{gameStats.totalBet?.toFixed(2) || 0} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Выигрыши:</span>
                    <span className="stat-value">{gameStats.totalWin?.toFixed(2) || 0} USDT</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Профит:</span>
                    <span className={`stat-value ${(gameStats.totalWin - gameStats.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
                      {((gameStats.totalWin || 0) - (gameStats.totalLoss || 0)).toFixed(2)} USDT
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
      
      <div className="game-header">
        <button className="back-button" onClick={onBack}>←</button>
        <h1 className="game-title">
          {gameType === 'coin' ? 'Монетка' : 
           gameType === 'mines' ? 'Мины' : 
           gameType === 'crash' ? 'Краш' : 
           gameType === 'slots' ? 'Слоты' : 'Игра'}
        </h1>
      </div>
      
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
