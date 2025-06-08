// frontend/src/screens/GameScreen.js - СТАБИЛЬНАЯ ВЕРСИЯ С ИСПРАВЛЕННОЙ МОНЕТКОЙ
import React, { useState, useEffect } from 'react';
import CoinGame from '../components/games/coin/CoinGame';
import MinesGame from '../components/games/mines/MinesGame';
import SlotGame from '../components/games/slots/SlotGame';
import CrashGame from '../components/games/crash/CrashGame';
import { Header } from '../components/layout';
import useTactileFeedback from '../hooks/useTactileFeedback';
import { userApi, gameApi } from '../services';
import '../styles/GameScreen.css';

const GameScreen = ({ gameType, userData, onBack, onBalanceUpdate, balance, setBalance }) => {
  // Добавляем тактильную обратную связь
  const { 
    navigationFeedback, 
    gameWinFeedback, 
    gameLoseFeedback 
  } = useTactileFeedback();

  // For Coin game - УПРОЩЕННЫЕ СОСТОЯНИЯ
  const [coinGameData, setCoinGameData] = useState({
    isPlaying: false,
    result: null,
    gameResult: null,
    showResult: false
  });
  const [lastResults, setLastResults] = useState([]);

  // Shared between games
  const [gameResult, setGameResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStats, setGameStats] = useState(null);

  // Обработчик кнопки назад с вибрацией
  const handleBackClick = () => {
    navigationFeedback();
    onBack();
  };

  // Обработчик изменения результата игры с вибрацией - ТОЛЬКО ДЛЯ НЕ-МОНЕТКИ
  useEffect(() => {
    if (gameType !== 'coin' && gameResult && gameResult.win !== null) {
      if (gameResult.win) {
        gameWinFeedback();
      } else {
        gameLoseFeedback();
      }
    }
  }, [gameType, gameResult, gameWinFeedback, gameLoseFeedback]);

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

        setError('Не удалось загрузить данные. Пожалуйста, попробуйте еще раз.');
        setLoading(false);
      }
    };

    fetchData();
  }, [gameType]);

  // ИСПРАВЛЕННЫЙ обработчик для монетки
  const handleCoinFlip = async (betData) => {

    try {
      // Устанавливаем состояние "игра начинается"
      setCoinGameData(prev => ({
        ...prev,
        isPlaying: true,
        result: null,
        gameResult: null,
        showResult: false
      }));

      setError(null);

      // Вызываем API
      const response = await gameApi.playCoinFlip(
        betData.betAmount,
        betData.selectedSide
      );

      const gameData = response.data.data;

      // Подготавливаем данные результата
      const newGameResult = {
        win: gameData.win,
        amount: Math.abs(gameData.profit),
        newBalance: gameData.balanceAfter
      };

      // ИСПРАВЛЕНО: Устанавливаем результат без showResult - он будет установлен через onAnimationComplete
      setCoinGameData(prev => ({
        ...prev,
        result: gameData.result,
        gameResult: newGameResult
        // showResult остается false до завершения анимации
      }));

      // Обновляем историю и баланс
      setLastResults(prev => [gameData.result, ...prev].slice(0, 10));
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
    } catch (err) {

      setError(err.response?.data?.message || 'Произошла ошибка при игре');

      // Сбрасываем состояние при ошибке
      setCoinGameData(prev => ({
        ...prev,
        isPlaying: false
      }));
    }
  };

  // ИСПРАВЛЕННЫЙ обработчик завершения анимации - синхронный показ результата
  const handleCoinAnimationComplete = (showResultNow) => {

    // ИСПРАВЛЕНО: Синхронно показываем результат и останавливаем игру
    if (showResultNow && coinGameData.gameResult) {
      setCoinGameData(prev => ({
        ...prev,
        showResult: true,
        isPlaying: false // Останавливаем игру сразу
      }));

      // Вибрация синхронно с показом результата
      if (coinGameData.gameResult.win) {
        gameWinFeedback();
      } else {
        gameLoseFeedback();
      }

      // Автоматически скрываем через 3 секунды
      setTimeout(() => {
        setCoinGameData(prev => ({
          ...prev,
          showResult: false
        }));
      }, 3000);
    } else {
      // Если нет результата для показа, просто завершаем игру
      setCoinGameData(prev => ({
        ...prev,
        isPlaying: false
      }));
    }
  };

  // Render appropriate game based on type
  const renderGame = () => {
    switch (gameType) {
      case 'coin':
        return (
          <div className="game-container coin-game">
            <CoinGame 
              balance={balance}
              setBalance={setBalance}
              gameStats={gameStats}
              setGameResult={setGameResult}
              setError={setError}
              onFlip={handleCoinFlip}
              isFlipping={coinGameData.isPlaying}
              result={coinGameData.result}
              lastResults={lastResults}
              onAnimationComplete={handleCoinAnimationComplete}
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
          </div>
        );

      case 'crash':
        return (
          <div className="game-container crash-game">
            <CrashGame 
              balance={balance}
              setBalance={setBalance}
              gameStats={gameStats}
              setGameResult={setGameResult}
              setError={setError}
              userTelegramId={userData?.telegramId}
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
            <button onClick={handleBackClick}>Вернуться на главную</button>
          </div>
        );
    }
  };

  return (
    <div className="game-screen">
      <Header balance={balance} />

      <div className="game-header">
        <button className="back-button" onClick={handleBackClick}>←</button>
        <h1 className="game-title">
          {gameType === 'coin' ? 'Монетка' : 
           gameType === 'mines' ? 'Мины' : 
           gameType === 'crash' ? 'Краш' : 
           gameType === 'slots' ? 'Слоты' : 'Игра'}
        </h1>
      </div>

      {/* ИСПРАВЛЕНО: Результат для монетки - показываем ТОЛЬКО когда showResult === true И анимация завершена */}
      {gameType === 'coin' && coinGameData.showResult && coinGameData.gameResult && !coinGameData.isPlaying && (
        <div className={`game-result ${coinGameData.gameResult.win ? 'win' : 'lose'}`}>
          <div className="result-text">
            {coinGameData.gameResult.win ? 'ВЫИГРЫШ!' : 'ПРОИГРЫШ'}
          </div>
          <div className="result-amount">
            {coinGameData.gameResult.win ? '+' : '-'}{coinGameData.gameResult.amount.toFixed(2)} USDT
          </div>
        </div>
      )}

      {/* Результат для остальных игр */}
      {gameType !== 'coin' && gameResult && (gameType !== 'crash' || gameResult.win !== null) && (
        <div className={`game-result ${gameResult.win ? 'win' : 'lose'}`}>
          <div className="result-text">
            {gameResult.win ? 
              (gameResult.isAutoCashOut ? '🤖 АВТОВЫВОД!' : 'ВЫИГРЫШ!') : 
              'ПРОИГРЫШ'}
          </div>
          <div className="result-amount">
            {gameResult.win ? '+' : '-'}{gameResult.amount.toFixed(2)} USDT
          </div>
          {gameResult.isAutoCashOut && gameResult.multiplier && (
            <div className="result-multiplier">
              Выведено при {gameResult.multiplier.toFixed(2)}x
            </div>
          )}
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
