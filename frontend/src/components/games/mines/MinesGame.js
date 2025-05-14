// MinesGame.js
import React, { useState, useEffect, useCallback } from 'react';
import { MinesGrid } from './index';
import { MinesControls } from './index';
import { gameApi } from '../../../services';

const MinesGame = ({ balance, setBalance, gameStats, setGameResult, setError }) => {
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
        // Сохраняем все открытые ячейки
        setClickedCells(data.clickedCells);
      }
      
      if (data.win === false) {
        // Попадание на мину - игра окончена
        
        // Обновляем сетку с позициями мин
        if (data.grid) {
          setGrid(data.grid);
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
  
  // Получаем количество открытых ячеек
  const revealedCount = clickedCells.length;
  
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
      />
    </>
  );
};

export default MinesGame;