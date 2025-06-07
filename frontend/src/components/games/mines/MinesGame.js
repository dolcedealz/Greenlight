// frontend/src/components/games/mines/MinesGame.js
import React, { useState, useEffect, useCallback } from 'react';
import { MinesGrid } from './index';
import { MinesControls } from './index';
import { gameApi } from '../../../services';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import '../../../styles/MinesGame.css';

const MinesGame = ({ balance, setBalance, gameStats, setGameResult, setError }) => {
  const { gameActionFeedback, criticalActionFeedback } = useTactileFeedback();
  
  // НОВОЕ: Состояние загрузки
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Состояние игры
  const [grid, setGrid] = useState(Array(5).fill().map(() => Array(5).fill('gem')));
  const [clickedCells, setClickedCells] = useState([]);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [betAmount, setBetAmount] = useState(1);
  const [minesCount, setMinesCount] = useState(5);
  const [currentMultiplier, setCurrentMultiplier] = useState(0.95);
  const [possibleWin, setPossibleWin] = useState(0.95);
  const [loading, setLoading] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  
  // НОВОЕ: Инициализация с загрузочным экраном
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Показываем загрузочный экран минимум 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИГРЫ В МИНЫ ===');
        setIsInitializing(false);
        
      } catch (err) {
        console.error('Ошибка инициализации мин:', err);
        setError('Ошибка загрузки игры');
        setIsInitializing(false);
      }
    };
    
    initializeGame();
  }, [setError]);
  
  // Обновление возможного выигрыша при изменении ставки или множителя
  useEffect(() => {
    setPossibleWin(betAmount * currentMultiplier);
  }, [betAmount, currentMultiplier]);
  
  // Запуск новой игры
  const startGame = useCallback(async () => {
    try {
      console.log("Начинаем новую игру в мины...");
      setLoading(true);
      
      // Сбрасываем состояние игры
      setGameOver(false);
      setClickedCells([]);
      setCurrentMultiplier(0.95);
      setPossibleWin(betAmount * 0.95);
      setGameActive(false);
      setGameResult(null);
      setError(null);
      
      // Создаем уникальный seed для игры
      const uniqueSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Отправляем запрос на создание игры
      const response = await gameApi.playMines(betAmount, minesCount, uniqueSeed);
      
      // Проверяем ответ от сервера
      const data = response.data.data;
      if (!data || !data.gameId) {
        throw new Error("API не вернул ID игры");
      }
      
      // Сохраняем ID игры
      setGameId(data.gameId);
      
      // Обновляем баланс
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Сбрасываем игровую сетку
      setGrid(Array(5).fill().map(() => Array(5).fill('gem')));
      
      // Активируем игру
      setGameActive(true);
      setLoading(false);
      
    } catch (err) {
      console.error("Ошибка при создании игры:", err);
      setError(err.response?.data?.message || "Не удалось создать игру");
      setLoading(false);
    }
  }, [betAmount, minesCount, setBalance, setError, setGameResult]);
  
  // Обработка клика по ячейке
  const handleCellClick = useCallback(async (row, col) => {
    // Проверка возможности хода
    if (!gameActive || gameOver || loading || !gameId) {
      return;
    }
    
    // Проверка, не открыта ли уже ячейка
    const cellAlreadyClicked = clickedCells.some(cell => 
      cell[0] === row && cell[1] === col
    );
    
    if (cellAlreadyClicked) {
      return;
    }
    
    try {
      // Блокируем интерфейс
      setLoading(true);
      
      // Отправляем запрос на сервер
      const response = await gameApi.completeMinesGame(
        gameId, 
        row, 
        col, 
        false
      );
      
      const data = response.data.data;
      
      // Получаем новые нажатые ячейки
      if (data.clickedCells) {
        // Сохраняем все открытые ячейки с правильным форматом
        setClickedCells(data.clickedCells);
        console.log('💣 GAME: Обновлены открытые ячейки:', data.clickedCells);
      }
      
      if (data.win === false) {
        // Попадание на мину - игра окончена
        
        // Обновляем сетку с позициями мин (с учетом модификаторов)
        if (data.grid) {
          setGrid(data.grid);
          console.log('💣 GAME: Игра окончена, обновлена сетка с минами:', data.grid);
        }
        
        // Если есть информация о фактическом количестве мин, показываем в консоли
        if (data.actualMinesCount) {
          console.log(`💣 GAME: Фактическое количество мин на поле: ${data.actualMinesCount} (выбрано: ${minesCount})`);
        }
        
        // Завершаем игру
        setGameActive(false);
        setGameOver(true);
        
        // Отображаем результат
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
        // Все безопасные ячейки открыты - максимальный выигрыш
        
        // Сохраняем состояние открытых ячеек
        if (data.clickedCells) {
          setClickedCells(data.clickedCells);
          console.log('💣 GAME: Максимальный выигрыш - сохранены открытые ячейки:', data.clickedCells);
        }
        
        // Показываем все мины на поле для полной картины
        if (data.grid) {
          setGrid(data.grid);
          console.log('💣 GAME: Максимальный выигрыш - показаны все мины на поле');
        }
        
        // Обновляем множитель
        const finalMultiplier = data.multiplier || (0.95 * (25 - minesCount));
        setCurrentMultiplier(finalMultiplier);
        setPossibleWin(betAmount * finalMultiplier);
        
        // Завершаем игру
        setGameActive(false);
        setGameOver(true);
        
        // Отображаем результат
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
        // Открыта безопасная ячейка - продолжаем игру
        
        // Обновляем множитель
        if (data.currentMultiplier) {
          setCurrentMultiplier(data.currentMultiplier);
          setPossibleWin(betAmount * data.currentMultiplier);
        }
        
        // Разблокируем интерфейс для продолжения игры
        setGameActive(true);
        
        // Проверяем условие автоигры
        if (autoplay && data.currentMultiplier >= 2) {
          setTimeout(() => handleCashout(), 500);
        }
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error("Ошибка при открытии ячейки:", err);
      setError(err.response?.data?.message || "Ошибка при открытии ячейки");
      setGameActive(true);
      setLoading(false);
    }
  }, [
    gameActive, gameOver, loading, clickedCells, betAmount, minesCount, gameId, 
    autoplay, setBalance, setError, setGameResult
  ]);
  
  // Функция кешаута (забрать выигрыш)
  const handleCashout = useCallback(async () => {
    // Проверка возможности выполнить кешаут
    if (!gameActive || gameOver || loading || !gameId) {
      return;
    }
    
    try {
      // Блокируем интерфейс
      setLoading(true);
      setGameActive(false);
      
      // Отправляем запрос на кешаут
      const response = await gameApi.completeMinesGame(
        gameId, 
        null, 
        null, 
        true
      );
      
      const data = response.data.data;
      
      // Сохраняем состояние открытых ячеек при кешауте
      if (data.clickedCells) {
        setClickedCells(data.clickedCells);
        console.log('💣 GAME: Кешаут - сохранены открытые ячейки:', data.clickedCells);
      }
      
      // Обновляем сетку при кешауте (показываем мины)
      if (data.grid) {
        setGrid(data.grid);
        console.log('💣 GAME: Кешаут - обновлена сетка с минами:', data.grid);
      }
      
      // Завершаем игру
      setGameOver(true);
      
      // Обновляем множитель
      if (data.multiplier) {
        setCurrentMultiplier(data.multiplier);
      }
      
      // Обновляем баланс
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Отображаем результат
      setGameResult({
        win: true,
        amount: data.profit,
        newBalance: data.balanceAfter
      });
      
      setLoading(false);
      
    } catch (err) {
      console.error("Ошибка при кешауте:", err);
      setError(err.response?.data?.message || "Ошибка при кешауте");
      setGameActive(true);
      setLoading(false);
    }
  }, [gameActive, gameOver, loading, gameId, setBalance, setError, setGameResult]);

  // НОВОЕ: Обработчики кнопок с вибрацией
  const handlePlayClick = () => {
    console.log('💣 GAME: Нажата кнопка "Играть"');
    
    if (gameActive || loading) {
      console.log('💣 GAME: Блокировано - игра активна или загрузка');
      return;
    }
    
    if (!betAmount || betAmount <= 0 || betAmount > balance) {
      console.log('💣 GAME: Блокировано - неверная ставка');
      return;
    }
    
    console.log('💣 GAME: Запускаем игру');
    gameActionFeedback(); // Вибрация при начале игры
    startGame();
  };

  const handleCashoutClick = () => {
    console.log('💣 GAME: Нажата кнопка "Забрать выигрыш"');
    
    if (!gameActive || loading) {
      console.log('💣 GAME: Блокировано - игра не активна или загрузка');
      return;
    }
    
    console.log('💣 GAME: Забираем выигрыш');
    criticalActionFeedback(); // Вибрация при кешауте
    handleCashout();
  };
  
  // Получаем количество открытых ячеек
  const revealedCount = clickedCells.length;
  
  // НОВОЕ: Загрузочный экран для мин
  if (isInitializing) {
    return (
      <div className="mines-loading-screen">
        <div className="mines-loading-content">
          <div className="greenlight-logo">
            <div className="logo-icon mines-icon">💣</div>
            <div className="logo-text">Greenlight</div>
            <div className="logo-subtitle">Mines Game</div>
          </div>
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <div className="loading-text">Загрузка мин...</div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <MinesGrid 
        grid={grid}
        clickedCells={clickedCells}
        onCellClick={handleCellClick}
        gameActive={gameActive}
        gameOver={gameOver}
        loading={loading}
      />
      
      {/* НОВОЕ: Кнопки действий под игровым полем */}
      <div className="mines-action-buttons">
        {!gameActive ? (
          <button 
            className="mines-play-button" 
            onClick={handlePlayClick}
            disabled={!betAmount || betAmount <= 0 || betAmount > balance || loading}
          >
            {loading ? 'Загрузка...' : 'Играть'}
          </button>
        ) : (
          <button 
            className="mines-cashout-button" 
            onClick={handleCashoutClick}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : `Забрать выигрыш (${possibleWin.toFixed(2)} USDT)`}
          </button>
        )}
      </div>
      
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
        onAutoplayChange={setAutoplay}
        autoplay={autoplay}
        loading={loading}
        // НОВОЕ: Скрываем кнопки в контролах, так как они теперь под полем
        hideActionButtons={true}
      />
    </>
  );
};

export default MinesGame;
