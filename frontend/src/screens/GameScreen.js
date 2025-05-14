// frontend/src/screens/GameScreen.js
import React, { useState, useEffect } from 'react';
import { CoinFlip, CoinControls } from '../components/games/coin';
import { MinesGrid, MinesControls } from '../components/games/mines';
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
          gameType: gameType,
          limit: 10
        });
        
        // Обрабатываем историю игр
        if (historyResponse.data.data.games && historyResponse.data.data.games.length > 0) {
          if (gameType === 'coin') {
            const results = historyResponse.data.data.games.map(game => 
              game.result.result
            );
            setLastResults(results);
          }
        }
        
        // Загружаем статистику игр
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
  
  // Компонент для игры "Мины"
  const MinesGame = () => {
    const [grid, setGrid] = useState(Array(5).fill().map(() => Array(5).fill('gem'))); // Игровое поле
    const [revealed, setRevealed] = useState(Array(25).fill(false)); // Массив открытых ячеек
    const [gameActive, setGameActive] = useState(false); // Активна ли игра
    const [gameOver, setGameOver] = useState(false); // Закончена ли игра
    const [betAmount, setBetAmount] = useState(1); // Сумма ставки
    const [minesCount, setMinesCount] = useState(5); // Количество мин
    const [currentMultiplier, setCurrentMultiplier] = useState(1); // Текущий множитель
    const [possibleWin, setPossibleWin] = useState(0); // Возможный выигрыш
    const [revealedCount, setRevealedCount] = useState(0); // Количество открытых ячеек
    const [gameData, setGameData] = useState(null); // Данные игры с сервера
    const [autoplay, setAutoplay] = useState(false); // Включена ли автоигра
    
    // Инициализация игры и расчет коэффициентов
    useEffect(() => {
      // Рассчитываем начальный возможный выигрыш
      setPossibleWin(betAmount);
    }, [betAmount]);
    
    // Создание нового игрового поля
    const createNewGrid = (mines) => {
      // Создаем пустое поле 5x5
      const newGrid = Array(5).fill().map(() => Array(5).fill('gem'));
      const positions = [];
      
      // Заполняем массив всеми возможными позициями
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          positions.push([i, j]);
        }
      }
      
      // Случайным образом выбираем позиции для мин
      for (let i = 0; i < mines; i++) {
        if (positions.length === 0) break;
        
        const randomIndex = Math.floor(Math.random() * positions.length);
        const [row, col] = positions[randomIndex];
        
        // Устанавливаем мину
        newGrid[row][col] = 'mine';
        
        // Удаляем эту позицию из массива
        positions.splice(randomIndex, 1);
      }
      
      return newGrid;
    };
    
    // Начало новой игры
    const startGame = async () => {
      try {
        // Создаем новую игру на сервере
        const response = await gameApi.playMines(betAmount, minesCount);
        const data = response.data.data;
        
        // Сохраняем данные игры
        setGameData(data);
        
        // Создаем новое игровое поле
        // В реальной игре сетка будет получена с сервера для предотвращения мошенничества
        const newGrid = createNewGrid(minesCount);
        
        // Инициализируем массив открытых ячеек
        const newRevealed = Array(25).fill(false);
        
        setGrid(newGrid);
        setRevealed(newRevealed);
        setGameActive(true);
        setGameOver(false);
        setRevealedCount(0);
        setCurrentMultiplier(1);
        setPossibleWin(betAmount);
        
        // Скрываем предыдущий результат игры, если он был
        setGameResult(null);
      } catch (err) {
        console.error('Ошибка при начале игры:', err);
        setError(err.response?.data?.message || 'Произошла ошибка при начале игры');
      }
    };
    
    // Обработчик клика по ячейке
    const handleCellClick = async (row, col) => {
      if (!gameActive) return;
      
      const index = row * 5 + col;
      const cell = grid[row][col];
      
      try {
        // Отправляем запрос на сервер о клике
        const response = await gameApi.completeMinesGame(
          gameData.gameId, 
          row, 
          col, 
          false
        );
        
        const data = response.data.data;
        
        // Создаем копию массива открытых ячеек
        const newRevealed = [...revealed];
        newRevealed[index] = true;
        setRevealed(newRevealed);
        
        // Увеличиваем счетчик открытых ячеек
        setRevealedCount(revealedCount + 1);
        
        if (cell === 'mine' || data.win === false) {
          // Игрок попал на мину
          // Открываем все мины
          const allRevealed = [...newRevealed];
          grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
              if (cell === 'mine') {
                allRevealed[rowIndex * 5 + colIndex] = true;
              }
            });
          });
          
          setRevealed(allRevealed);
          setGameActive(false);
          setGameOver(true);
          
          // Уведомляем пользователя о проигрыше
          setGameResult({
            win: false,
            amount: betAmount,
            newBalance: balance - betAmount
          });
          
          // Обновляем баланс
          setBalance(prev => prev - betAmount);
          
          // Обновляем статистику
          if (gameStats) {
            const updatedStats = { ...gameStats };
            updatedStats.totalGames += 1;
            updatedStats.totalBet += betAmount;
            updatedStats.totalLoss += betAmount;
            updatedStats.winRate = updatedStats.winCount / updatedStats.totalGames;
            setGameStats(updatedStats);
          }
        } else if (data.maxWin) {
          // Игрок открыл все безопасные ячейки - максимальный выигрыш
          setCurrentMultiplier(data.multiplier);
          setPossibleWin(betAmount * data.multiplier);
          
          // Обновляем баланс
          setBalance(data.balanceAfter);
          
          // Уведомляем пользователя о выигрыше
          setGameResult({
            win: true,
            amount: data.profit,
            newBalance: data.balanceAfter
          });
          
          // Завершаем игру
          setGameActive(false);
          
          // Обновляем статистику
          if (gameStats) {
            const updatedStats = { ...gameStats };
            updatedStats.totalGames += 1;
            updatedStats.totalBet += betAmount;
            updatedStats.winCount += 1;
            updatedStats.totalWin += data.profit;
            updatedStats.winRate = updatedStats.winCount / updatedStats.totalGames;
            setGameStats(updatedStats);
          }
        } else {
          // Игрок нашел сокровище
          // Обновляем множитель и возможный выигрыш
          setCurrentMultiplier(data.currentMultiplier);
          setPossibleWin(data.possibleWin);
          
          // Проверяем условие автоигры
          if (autoplay && data.currentMultiplier >= 2) {
            // Автоматически забираем выигрыш
            handleCashout();
          }
        }
      } catch (err) {
        console.error('Ошибка при клике по ячейке:', err);
        setError(err.response?.data?.message || 'Произошла ошибка при игре');
      }
    };
    
    // Забрать выигрыш
    const handleCashout = async () => {
      if (!gameActive) return;
      
      try {
        // Отправляем запрос на сервер о выигрыше
        const response = await gameApi.completeMinesGame(
          gameData.gameId, 
          null, 
          null, 
          true
        );
        
        const data = response.data.data;
        
        // Обновляем баланс
        setBalance(data.balanceAfter);
        
        // Уведомляем пользователя о выигрыше
        setGameResult({
          win: true,
          amount: data.profit,
          newBalance: data.balanceAfter
        });
        
        // Завершаем игру
        setGameActive(false);
        
        // Обновляем статистику
        if (gameStats) {
          const updatedStats = { ...gameStats };
          updatedStats.totalGames += 1;
          updatedStats.totalBet += betAmount;
          updatedStats.winCount += 1;
          updatedStats.totalWin += data.profit;
          updatedStats.winRate = updatedStats.winCount / updatedStats.totalGames;
          setGameStats(updatedStats);
        }
      } catch (err) {
        console.error('Ошибка при получении выигрыша:', err);
        setError(err.response?.data?.message || 'Произошла ошибка при получении выигрыша');
      }
    };
    
    // Обработчик изменения автоигры
    const handleAutoplayChange = (value) => {
      setAutoplay(value);
    };
    
    return (
      <>
        <MinesGrid 
          grid={grid}
          revealed={revealed}
          onCellClick={handleCellClick}
          gameActive={gameActive}
          gameOver={gameOver}
        />
        
        <MinesControls 
          balance={balance}
          onPlay={startGame}
          onCashout={handleCashout}
          gameActive={gameActive}
          currentMultiplier={currentMultiplier}
          possibleWin={possibleWin}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          minesCount={minesCount}
          setMinesCount={setMinesCount}
          revealedCount={revealedCount}
          onAutoplayChange={handleAutoplayChange}
          autoplay={autoplay}
        />
        
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
      </>
    );
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
            <MinesGame />
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
      
      {/* Отображение ошибки */}
      {error && !gameResult && (
        <div className="game-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default GameScreen;