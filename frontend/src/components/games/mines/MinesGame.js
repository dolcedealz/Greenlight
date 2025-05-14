// MinesGame.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MinesGrid } from './index';
import { MinesControls } from './index';
import { gameApi } from '../../../services';

const MinesGame = ({ balance, setBalance, gameStats, setGameResult, setError }) => {
  // Состояние игры
  const [grid, setGrid] = useState(Array(5).fill().map(() => Array(5).fill('gem')));
  const [revealed, setRevealed] = useState(Array(25).fill(false));
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [betAmount, setBetAmount] = useState(1);
  const [minesCount, setMinesCount] = useState(5);
  const [currentMultiplier, setCurrentMultiplier] = useState(0.95);
  const [possibleWin, setPossibleWin] = useState(0.95);
  const [loading, setLoading] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  
  // Референсы для хранения данных между рендерами
  const gameDataRef = useRef(null);
  const clickedCellsRef = useRef([]); // Храним открытые ячейки локально
  
  // Получаем количество открытых ячеек
  const revealedCount = clickedCellsRef.current.length;
  
  // Обновление возможного выигрыша при изменении ставки или множителя
  useEffect(() => {
    setPossibleWin(betAmount * currentMultiplier);
  }, [betAmount, currentMultiplier]);
  
  // Обновление множителя на основе количества открытых ячеек
  const calculateMultiplier = useCallback((openedCells) => {
    const safeTotal = 25 - minesCount;
    const remaining = safeTotal - openedCells.length;
    if (remaining <= 0) return 0;
    
    // Формула расчета множителя: (безопасных_всего / оставшихся_безопасных) * 0.95
    return (safeTotal / remaining) * 0.95;
  }, [minesCount]);
  
  // Запуск новой игры
  const startGame = useCallback(async () => {
    try {
      console.log("MINES COMPONENT: Начинаем новую игру...");
      setLoading(true);
      
      // Сбрасываем состояние игры
      setGameOver(false);
      setRevealed(Array(25).fill(false));
      clickedCellsRef.current = []; // Сбрасываем локальный список открытых ячеек
      setCurrentMultiplier(0.95);
      setPossibleWin(betAmount * 0.95);
      setGameActive(false);
      setGameResult(null);
      setError(null);
      
      // Создаем уникальный seed для игры
      const uniqueSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`Запуск игры "Мины": {betAmount: ${betAmount}, minesCount: ${minesCount}, clientSeed: '${uniqueSeed}'}`);
      
      // Отправляем запрос на создание игры
      const response = await gameApi.playMines(betAmount, minesCount, uniqueSeed);
      
      // Проверяем ответ от сервера
      const data = response.data.data;
      if (!data || !data.gameId) {
        throw new Error("API не вернул ID игры");
      }
      
      // Сохраняем данные игры в референс
      gameDataRef.current = data;
      console.log(`Игра создана с ID: ${data.gameId}`);
      
      // Обновляем баланс
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Сбрасываем игровую сетку
      setGrid(Array(5).fill().map(() => Array(5).fill('gem')));
      
      // Активируем игру после небольшой задержки для завершения обновлений состояния
      setTimeout(() => {
        setGameActive(true);
        setLoading(false);
      }, 100);
      
    } catch (err) {
      console.error("MINES COMPONENT: Ошибка при создании игры:", err);
      setError(err.response?.data?.message || "Не удалось создать игру");
      setLoading(false);
    }
  }, [betAmount, minesCount, setBalance, setError, setGameResult]);
  
  // Обработка клика по ячейке
  const handleCellClick = useCallback(async (row, col) => {
    // Проверка возможности хода
    if (!gameActive || gameOver || loading) {
      console.log("MINES COMPONENT: Клик игнорирован - игра не активна");
      return;
    }
    
    // Проверка наличия игровых данных
    if (!gameDataRef.current?.gameId) {
      console.error("MINES COMPONENT: Нет данных игры");
      setError("Данные игры не найдены. Пожалуйста, начните новую игру.");
      return;
    }
    
    const index = row * 5 + col;
    
    // Проверка, не открыта ли уже ячейка
    if (revealed[index]) {
      console.log("MINES COMPONENT: Ячейка уже открыта");
      return;
    }
    
    try {
      // Блокируем интерфейс на время запроса
      setLoading(true);
      setGameActive(false);
      
      // Отправляем запрос на сервер
      console.log(`Открываем ячейку [${row},${col}]`);
      const response = await gameApi.completeMinesGame(
        gameDataRef.current.gameId, 
        row, 
        col, 
        false
      );
      
      console.log("Получен ответ:", response.data);
      const data = response.data.data;
      
      // Важно! Сервер возвращает только последнюю открытую ячейку,
      // поэтому мы должны сами отслеживать все открытые ячейки
      if (data.clickedCells && data.clickedCells.length > 0) {
        // Получаем последнюю открытую ячейку из ответа
        const [lastRow, lastCol] = data.clickedCells[0];
        
        // Добавляем её в наш локальный список, если её там еще нет
        const alreadyExists = clickedCellsRef.current.some(
          ([r, c]) => r === lastRow && c === lastCol
        );
        
        if (!alreadyExists) {
          clickedCellsRef.current.push([lastRow, lastCol]);
        }
        
        // Обновляем отображение открытых ячеек
        const newRevealed = [...revealed];
        newRevealed[lastRow * 5 + lastCol] = true;
        setRevealed(newRevealed);
      }
      
      if (data.win === false) {
        // Попадание на мину - игра окончена
        console.log("Игрок попал на мину - игра окончена");
        
        // Обновляем сетку с позициями мин, если сервер прислал их
        if (data.grid) {
          setGrid(data.grid);
          
          // Показываем все мины
          const allRevealed = [...revealed];
          data.grid.forEach((rowData, rowIndex) => {
            rowData.forEach((cell, colIndex) => {
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
        console.log("Все безопасные ячейки открыты - максимальный выигрыш");
        
        // Получаем множитель либо из ответа, либо рассчитываем сами
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
          newBalance: data.balanceAfter,
          serverSeedHashed: data.serverSeedHashed,
          clientSeed: data.clientSeed,
          nonce: data.nonce
        });
        
        // Обновляем баланс
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
      } else {
        // Открыта безопасная ячейка - игра продолжается
        console.log("Открыта безопасная ячейка - продолжаем игру");
        
        // Обновляем множитель - либо используем значение от сервера,
        // либо рассчитываем самостоятельно на основе открытых ячеек
        const newMultiplier = data.currentMultiplier || calculateMultiplier(clickedCellsRef.current);
        setCurrentMultiplier(newMultiplier);
        setPossibleWin(betAmount * newMultiplier);
        console.log(`Новый множитель: ${newMultiplier}`);
        
        // Разблокируем интерфейс для продолжения игры
        setGameActive(true);
        
        // Проверяем условие автоигры
        if (autoplay && newMultiplier >= 2) {
          console.log("Сработало условие автоигры - выполняем кешаут");
          setTimeout(() => handleCashout(), 500);
        }
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error("MINES COMPONENT: Ошибка при открытии ячейки:", err);
      setError(err.response?.data?.message || "Ошибка при открытии ячейки");
      // Возвращаем игру в активное состояние при ошибке
      setGameActive(true);
      setLoading(false);
    }
  }, [
    gameActive, gameOver, loading, revealed, betAmount, minesCount, 
    autoplay, calculateMultiplier, setBalance, setError, setGameResult
  ]);
  
  // Функция кешаута (забрать выигрыш)
  const handleCashout = useCallback(async () => {
    console.log("MINES COMPONENT: Cashout requested, gameActive=", gameActive);
    
    // Проверка возможности выполнить кешаут
    if (!gameActive || gameOver || loading) {
      console.log("MINES COMPONENT: Cannot cashout - game not active");
      return;
    }
    
    // Проверка наличия данных игры
    if (!gameDataRef.current?.gameId) {
      console.error("MINES COMPONENT: No game data for cashout");
      setError("Данные игры не найдены. Пожалуйста, начните новую игру.");
      return;
    }
    
    try {
      // Блокируем интерфейс
      setLoading(true);
      setGameActive(false);
      
      // Отправляем запрос на кешаут
      console.log("MINES COMPONENT: Sending cashout request");
      const response = await gameApi.completeMinesGame(
        gameDataRef.current.gameId, 
        null, 
        null, 
        true
      );
      
      const data = response.data.data;
      
      // Завершаем игру
      setGameOver(true);
      
      // Обновляем множитель, если сервер его вернул
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
        newBalance: data.balanceAfter,
        serverSeedHashed: data.serverSeedHashed,
        clientSeed: data.clientSeed,
        nonce: data.nonce
      });
      
      setLoading(false);
      
    } catch (err) {
      console.error("MINES COMPONENT: Error during cashout:", err);
      setError(err.response?.data?.message || "Ошибка при кешауте");
      // Возвращаем игру в активное состояние при ошибке
      setGameActive(true);
      setLoading(false);
    }
  }, [gameActive, gameOver, loading, setBalance, setError, setGameResult]);
  
  // Управление режимом автоигры
  const handleAutoplayChange = useCallback((value) => {
    console.log("MINES COMPONENT: Autoplay changed to:", value);
    setAutoplay(value);
  }, []);
  
  return (
    <>
      <MinesGrid 
        grid={grid}
        revealed={revealed}
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
        onAutoplayChange={handleAutoplayChange}
        autoplay={autoplay}
        loading={loading}
      />
    </>
  );
};

export default MinesGame;