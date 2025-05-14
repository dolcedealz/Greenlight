// frontend/src/screens/GameScreen.js
import React, { useState, useEffect, useRef } from 'react';  // Добавлен useRef
import { CoinFlip, CoinControls } from '../components/games/coin';
import { MinesGrid, MinesControls } from '../components/games/mines';
import { Header } from '../components/layout';
import { userApi, gameApi } from '../services';
import '../styles/GameScreen.css';

const GameScreen = ({ gameType, userData, onBack, onBalanceUpdate, balance, setBalance }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [lastResults, setLastResults] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStats, setGameStats] = useState(null);
  
  // Загрузка истории игр и статистики при монтировании
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
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
        if (gameData.balanceAfter !== undefined) {
          setBalance(gameData.balanceAfter);
        }
        
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
    const [grid, setGrid] = useState(Array(5).fill().map(() => Array(5).fill('gem')));
    const [revealed, setRevealed] = useState(Array(25).fill(false));
    const [gameActive, setGameActive] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [betAmount, setBetAmount] = useState(1);
    const [minesCount, setMinesCount] = useState(5);
    const [currentMultiplier, setCurrentMultiplier] = useState(1);
    const [possibleWin, setPossibleWin] = useState(0);
    const [revealedCount, setRevealedCount] = useState(0);
    const [autoplay, setAutoplay] = useState(false);
    
    // Важно: используем useRef для хранения gameData, чтобы избежать проблем с асинхронным обновлением состояния
    const gameDataRef = useRef(null);
    
    // Логирование для отладки
    useEffect(() => {
      console.log("Состояние gameActive изменилось на:", gameActive);
    }, [gameActive]);
  
    // Инициализация и расчет коэффициентов
    useEffect(() => {
      setPossibleWin(betAmount);
    }, [betAmount]);
    
    // Начало новой игры
  const startGame = async () => {
    try {
      console.log("Начинаем новую игру...");
      setError(null);
      setGameResult(null);
      setGameOver(false);
      
      // Создаем уникальный seed
      const uniqueSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log("Уникальный seed для игры:", uniqueSeed);

      // Создаем новую игру на сервере
      console.log("Отправляем запрос на создание игры...");
      const response = await gameApi.playMines(betAmount, minesCount, uniqueSeed);
      console.log("Ответ сервера:", response.data);
      
      const data = response.data.data;
      if (!data || !data.gameId) {
        console.error("Ошибка: API не вернул gameId", data);
        setError("Ошибка: Не получен ID игры от сервера");
        return;
      }
      
      // Сохраняем данные игры в ref
      gameDataRef.current = data;
      console.log("ID новой игры:", data.gameId);
      
      // Сбрасываем игровое поле
      setGrid(Array(5).fill().map(() => Array(5).fill('gem')));
      setRevealed(Array(25).fill(false));
      setRevealedCount(0);
      setCurrentMultiplier(1);
      setPossibleWin(betAmount);
      
      // Обновляем баланс
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // ИЗМЕНЕНИЕ: Используем таймаут для активации игры 
      // чтобы убедиться, что все обновления состояния завершены
      console.log("Планируем активацию игры...");
      setTimeout(() => {
        console.log("Активируем игру через setTimeout");
        setGameActive(true);
      }, 100);
      
    } catch (err) {
      console.error("Ошибка при начале игры:", err);
      setError(err.response?.data?.message || "Произошла ошибка при начале игры");
    }
  };
  
  // Модифицируем обработчик клика, добавляя больше логирования
  const handleCellClick = async (row, col) => {
    console.log(`Клик по ячейке [${row}, ${col}], gameActive: ${gameActive}, gameData: ${gameDataRef.current?.gameId}`);
    
    if (!gameActive) {
      console.log("Игра не активна, клик игнорируется");
      return;
    }
      
      // Проверяем наличие данных игры
      if (!gameDataRef.current || !gameDataRef.current.gameId) {
        console.error("Отсутствуют данные игры:", gameDataRef.current);
        setError("Ошибка: отсутствуют данные игры. Пожалуйста, начните игру заново.");
        return;
      }
      
      const index = row * 5 + col;
      
      // Проверяем, не открыта ли уже эта ячейка
      if (revealed[index]) {
        console.log("Ячейка уже открыта, клик игнорируется");
        return;
      }
      
      try {
        console.log(`Отправляем запрос на клик по ячейке [${row}, ${col}], gameId: ${gameDataRef.current.gameId}`);
        
        // Временно деактивируем игру для предотвращения множественных кликов
        setGameActive(false);
        
        // Отправляем запрос на сервер
        const response = await gameApi.completeMinesGame(
          gameDataRef.current.gameId, 
          row, 
          col, 
          false
        );
        
        console.log("Ответ сервера на клик:", response.data);
        
        const data = response.data.data;
        
        // Создаем копию массива открытых ячеек
        const newRevealed = [...revealed];
        newRevealed[index] = true;
        setRevealed(newRevealed);
        
        // Увеличиваем счетчик открытых ячеек
        const newRevealedCount = revealedCount + 1;
        setRevealedCount(newRevealedCount);
        
        if (data.win === false) {
          // Игрок попал на мину
          console.log("Попадание на мину - игра окончена");
          
          // Если сервер прислал игровое поле, используем его
          if (data.grid) {
            setGrid(data.grid);
            
            // Открываем все мины
            const allRevealed = [...newRevealed];
            data.grid.forEach((row, rowIndex) => {
              row.forEach((cell, colIndex) => {
                if (cell === 'mine') {
                  allRevealed[rowIndex * 5 + colIndex] = true;
                }
              });
            });
            setRevealed(allRevealed);
          }
          
          // Завершаем игру
          setGameActive(false);
          setGameOver(true);
          
          // Показываем результат
          setGameResult({
            win: false,
            amount: betAmount,
            newBalance: data.balanceAfter
          });
          
          // Обновляем баланс
          if (data.balanceAfter !== undefined) {
            setBalance(data.balanceAfter);
          }
          
        } else if (data.maxWin === true) {
          // Игрок открыл все безопасные ячейки - максимальный выигрыш
          console.log("Все безопасные ячейки открыты - максимальный выигрыш!");
          
          const finalMultiplier = data.multiplier || (data.currentMultiplier || 1);
          setCurrentMultiplier(finalMultiplier);
          setPossibleWin(betAmount * finalMultiplier);
          
          // Завершаем игру
          setGameActive(false);
          setGameOver(true);
          
          // Показываем результат
          setGameResult({
            win: true,
            amount: data.profit,
            newBalance: data.balanceAfter
          });
          
          // Обновляем баланс
          if (data.balanceAfter !== undefined) {
            setBalance(data.balanceAfter);
          }
          
        } else {
          // Игрок открыл безопасную ячейку, игра продолжается
          console.log("Найдено сокровище, игра продолжается");
          
          // Обновляем множитель и возможный выигрыш
          if (data.currentMultiplier !== undefined) {
            setCurrentMultiplier(data.currentMultiplier);
            setPossibleWin(betAmount * data.currentMultiplier);
          }
          
          // Активируем игру снова
          setGameActive(true);
          
          // Проверяем условие автоигры
          if (autoplay && data.currentMultiplier >= 2) {
            console.log("Сработало условие автоигры - забираем выигрыш");
            setTimeout(() => {
              handleCashout();
            }, 500);
          }
        }
      } catch (err) {
        console.error("Ошибка при клике по ячейке:", err);
        setError(err.response?.data?.message || "Произошла ошибка при игре");
        
        // Восстанавливаем активность игры в случае ошибки
        setGameActive(true);
      }
    };
    
    // Забрать выигрыш - переработано
    const handleCashout = async () => {
      console.log("Забираем выигрыш, gameActive:", gameActive);
      
      if (!gameActive) {
        console.log("Игра не активна, кешаут невозможен");
        return;
      }
      
      // Проверяем наличие данных игры
      if (!gameDataRef.current || !gameDataRef.current.gameId) {
        console.error("Отсутствуют данные игры:", gameDataRef.current);
        setError("Ошибка: отсутствуют данные игры для кешаута");
        return;
      }
      
      try {
        console.log("Отправляем запрос на кешаут, gameId:", gameDataRef.current.gameId);
        
        // Деактивируем игру на время запроса
        setGameActive(false);
        
        // Отправляем запрос на сервер
        const response = await gameApi.completeMinesGame(
          gameDataRef.current.gameId, 
          null, 
          null, 
          true
        );
        
        console.log("Ответ сервера на кешаут:", response.data);
        
        const data = response.data.data;
        
        // Обновляем баланс
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
        // Показываем результат
        setGameResult({
          win: true,
          amount: data.profit,
          newBalance: data.balanceAfter,
          serverSeedHashed: data.serverSeedHashed,
          clientSeed: data.clientSeed,
          nonce: data.nonce
        });
        
      } catch (err) {
        console.error("Ошибка при получении выигрыша:", err);
        setError(err.response?.data?.message || "Произошла ошибка при получении выигрыша");
        
        // Восстанавливаем активность игры в случае ошибки
        setGameActive(true);
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