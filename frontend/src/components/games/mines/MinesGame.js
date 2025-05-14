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
  const [revealedCount, setRevealedCount] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Референс для данных игры
  const gameDataRef = useRef(null);
  
  // Обновление возможного выигрыша
  useEffect(() => {
    setPossibleWin(betAmount * currentMultiplier);
  }, [betAmount, currentMultiplier]);
  
  // Старт новой игры
  const startGame = useCallback(async () => {
    try {
      console.log("Начинаем новую игру в Мины");
      setLoading(true);
      
      // Сбрасываем состояние игры
      setGameOver(false);
      setRevealed(Array(25).fill(false));
      setRevealedCount(0);
      setCurrentMultiplier(0.95);
      setPossibleWin(betAmount * 0.95);
      setGameActive(false);
      setGameResult(null);
      setError(null);
      
      // Генерируем уникальный seed
      const uniqueSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Запрашиваем создание игры на сервере
      console.log(`Отправка запроса на создание игры: {betAmount: ${betAmount}, minesCount: ${minesCount}}`);
      const response = await gameApi.playMines(betAmount, minesCount, uniqueSeed);
      
      const data = response.data.data;
      if (!data || !data.gameId) {
        throw new Error("Сервер не вернул ID игры");
      }
      
      // Сохраняем данные игры
      gameDataRef.current = data;
      console.log(`Игра создана с ID: ${data.gameId}`);
      
      // Обновляем баланс
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Сбрасываем игровое поле
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
    // Проверяем, активна ли игра
    if (!gameActive || gameOver || loading) {
      console.log("Игра неактивна или завершена, клик игнорируется");
      return;
    }
    
    // Проверяем, есть ли данные игры
    if (!gameDataRef.current?.gameId) {
      console.error("Отсутствуют данные игры");
      setError("Данные игры не найдены. Начните новую игру.");
      return;
    }
    
    const index = row * 5 + col;
    
    // Проверяем, не открыта ли уже ячейка
    if (revealed[index]) {
      console.log("Ячейка уже открыта");
      return;
    }
    
    try {
      setLoading(true);
      // Временно блокируем дальнейшие действия
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
      
      // Обновляем отображение открытых ячеек
      const newRevealed = [...revealed];
      newRevealed[index] = true;
      setRevealed(newRevealed);
      
      // Увеличиваем счётчик открытых ячеек
      setRevealedCount(prevCount => prevCount + 1);
      
      if (data.win === false) {
        // Игрок попал на мину - игра окончена
        console.log("Игрок попал на мину - игра окончена");
        
        // Обновляем сетку, если сервер предоставил полное расположение мин
        if (data.grid) {
          setGrid(data.grid);
          
          // Показываем все мины
          const allRevealed = [...newRevealed];
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
        // Все безопасные ячейки открыты - максимальный выигрыш
        console.log("Все безопасные ячейки открыты - максимальный выигрыш");
        
        const finalMultiplier = data.multiplier || 0.95 * (25 - minesCount);
        setCurrentMultiplier(finalMultiplier);
        setPossibleWin(betAmount * finalMultiplier);
        
        // Завершаем игру
        setGameActive(false);
        setGameOver(true);
        
        // Показываем результат
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
        // Открыта безопасная ячейка - продолжаем игру
        console.log("Открыта безопасная ячейка - продолжаем игру");
        
        // Обновляем множитель и возможный выигрыш
        if (data.currentMultiplier !== undefined) {
          setCurrentMultiplier(data.currentMultiplier);
          setPossibleWin(betAmount * data.currentMultiplier);
          console.log(`Новый множитель: ${data.currentMultiplier}`);
        }
        
        // Разблокируем игру
        setGameActive(true);
        
        // Проверяем условие автоигры
        if (autoplay && data.currentMultiplier >= 2) {
          console.log("Сработало условие автоигры - выполняем кешаут");
          // Небольшая задержка для анимации
          setTimeout(() => handleCashout(), 500);
        }
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error("Ошибка при открытии ячейки:", err);
      setError(err.response?.data?.message || "Ошибка при открытии ячейки");
      // Разблокируем игру при ошибке
      setGameActive(true);
      setLoading(false);
    }
  }, [gameActive, gameOver, loading, revealed, betAmount, autoplay, minesCount, setBalance, setError, setGameResult]);
  
  // Функция кешаута (забрать выигрыш)
  const handleCashout = useCallback(async () => {
    console.log("Запрос на кешаут, gameActive =", gameActive);
    
    // Проверка состояния игры
    if (!gameActive || gameOver || loading) {
      console.log("Кешаут невозможен - игра неактивна или завершена");
      return;
    }
    
    // Проверка наличия данных игры
    if (!gameDataRef.current?.gameId) {
      console.error("Отсутствуют данные игры для кешаута");
      setError("Данные игры не найдены. Начните новую игру.");
      return;
    }
    
    try {
      setLoading(true);
      // Блокируем интерфейс
      setGameActive(false);
      
      // Отправляем запрос на кешаут
      console.log("Отправка запроса на кешаут");
      const response = await gameApi.completeMinesGame(
        gameDataRef.current.gameId, 
        null, 
        null, 
        true
      );
      
      const data = response.data.data;
      
      // Завершаем игру
      setGameOver(true);
      
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
      
      setLoading(false);
      
    } catch (err) {
      console.error("Ошибка при кешауте:", err);
      setError(err.response?.data?.message || "Ошибка при выполнении кешаута");
      // Разблокируем игру при ошибке
      setGameActive(true);
      setLoading(false);
    }
  }, [gameActive, gameOver, loading, setBalance, setError, setGameResult]);
  
  // Переключение режима автоигры
  const handleAutoplayChange = useCallback((value) => {
    console.log("Автоигра переключена на:", value);
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