// frontend/src/components/games/crash/CrashGame.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CrashGraph from './CrashGraph';
import CrashControls from './CrashControls';
import CrashHistory from './CrashHistory';
import CrashBetsList from './CrashBetsList';
import { gameApi } from '../../../services';
import '../../../styles/CrashGame.css';

const CrashGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError 
}) => {
  // Состояние игры
  const [gameState, setGameState] = useState('waiting'); // waiting, flying, crashed
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState(null);
  const [roundId, setRoundId] = useState(1);
  const [timeToStart, setTimeToStart] = useState(5); // УМЕНЬШИЛИ с 7 до 5 секунд
  
  // Ставки и управление
  const [betAmount, setBetAmount] = useState(1);
  const [autoCashOut, setAutoCashOut] = useState(2.00);
  const [hasBet, setHasBet] = useState(false);
  const [userBet, setUserBet] = useState(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // История и статистика
  const [roundHistory, setRoundHistory] = useState([]);
  const [activeBets, setActiveBets] = useState([]);
  const [cashedOutBets, setCashedOutBets] = useState([]);
  
  // Рефы для управления игрой
  const gameLoopRef = useRef(null);
  const waitingTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isGameRunningRef = useRef(false);
  
  // Очистка таймеров
  const clearAllTimers = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (waitingTimerRef.current) {
      clearInterval(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    isGameRunningRef.current = false;
  }, []);
  
  // Генерация случайного краш-поинта
  const generateCrashPoint = useCallback(() => {
    // Используем формулу для краш-игр
    const random = Math.random() * 0.98 + 0.01; // от 0.01 до 0.99
    const crashPoint = Math.max(1.01, 99 / (random * 99));
    return Math.min(crashPoint, 100); // Ограничиваем максимум 100x
  }, []);
  
  // Обработка краха
  const handleCrash = useCallback((finalCrashPoint) => {
    console.log('КРАШ: Игра крашнулась на', finalCrashPoint.toFixed(2) + 'x');
    
    clearAllTimers();
    
    setGameState('crashed');
    setCurrentMultiplier(finalCrashPoint);
    setCrashPoint(finalCrashPoint);
    
    // Добавляем в историю
    const roundData = {
      roundId: roundId,
      crashPoint: finalCrashPoint,
      timestamp: Date.now(),
      totalBets: activeBets.length + (hasBet ? 1 : 0),
      totalAmount: activeBets.reduce((sum, bet) => sum + bet.amount, 0) + (hasBet ? userBet?.amount || 0 : 0)
    };
    
    setRoundHistory(prev => [roundData, ...prev.slice(0, 19)]);
    
    // Проверяем результат пользователя
    if (hasBet && !cashedOut) {
      console.log('КРАШ: Пользователь проиграл');
      setGameResult({
        win: false,
        amount: userBet?.amount || 0,
        newBalance: balance
      });
    }
    
    // Запускаем новый цикл через 2 секунды (УМЕНЬШИЛИ с 3 до 2 секунд)
    setTimeout(() => {
      console.log('КРАШ: Сброс и запуск нового цикла');
      resetForNewRound();
    }, 2000);
  }, [roundId, activeBets, hasBet, cashedOut, userBet, balance, setGameResult, clearAllTimers]);
  
  // Сброс состояния для нового раунда
  const resetForNewRound = useCallback(() => {
    console.log('КРАШ: Сброс состояния для нового раунда');
    
    setHasBet(false);
    setUserBet(null);
    setCashedOut(false);
    setActiveBets([]);
    setCashedOutBets([]);
    setRoundId(prev => prev + 1);
    
    // Запускаем период ожидания
    startWaitingPhase();
  }, []);
  
  // Период ожидания (5 секунд вместо 7)
  const startWaitingPhase = useCallback(() => {
    console.log('КРАШ: Начало фазы ожидания');
    
    clearAllTimers();
    
    setGameState('waiting');
    setTimeToStart(5); // УМЕНЬШИЛИ с 7 до 5 секунд
    setCurrentMultiplier(1.00);
    setCrashPoint(null);
    
    // Запускаем обратный отсчет
    waitingTimerRef.current = setInterval(() => {
      setTimeToStart(prev => {
        console.log('КРАШ: Таймер:', prev - 1);
        
        if (prev <= 1) {
          console.log('КРАШ: Таймер закончился, запускаем игру');
          clearInterval(waitingTimerRef.current);
          waitingTimerRef.current = null;
          
          // Запускаем игру через короткую задержку
          setTimeout(() => {
            startFlyingPhase();
          }, 100);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearAllTimers]);
  
  // Игровая фаза (полет) - УСКОРЕННАЯ
  const startFlyingPhase = useCallback(() => {
    console.log('КРАШ: Начало игровой фазы');
    
    clearAllTimers();
    
    // Генерируем краш-поинт
    const newCrashPoint = generateCrashPoint();
    console.log('КРАШ: Сгенерирован краш-поинт:', newCrashPoint.toFixed(2));
    
    setGameState('flying');
    setCurrentMultiplier(1.00);
    setCrashPoint(newCrashPoint);
    
    // Если у игрока есть ставка, добавляем её в активные
    if (hasBet && userBet) {
      setActiveBets([{
        ...userBet,
        id: Date.now(),
        isCurrentUser: true
      }]);
    }
    
    // Запускаем игровой цикл
    startTimeRef.current = Date.now();
    isGameRunningRef.current = true;
    
    const gameLoop = () => {
      if (!isGameRunningRef.current) {
        console.log('КРАШ: Игровой цикл остановлен');
        return;
      }
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      
      // УСКОРЕННАЯ экспоненциальная формула роста множителя
      // Увеличили коэффициент с 0.00006 до 0.0008 (в 13+ раз быстрее)
      const multiplier = Math.pow(Math.E, 0.0008 * elapsed * elapsed);
      const currentMult = Math.max(1.00, multiplier);
      
      setCurrentMultiplier(currentMult);
      
      // Проверяем автовывод
      if (hasBet && !cashedOut && autoCashOut > 0 && currentMult >= autoCashOut) {
        console.log('КРАШ: Сработал автовывод при', currentMult.toFixed(2));
        handleCashOut();
        return;
      }
      
      // Проверяем краш
      if (currentMult >= newCrashPoint) {
        console.log('КРАШ: Достигнут краш-поинт', newCrashPoint.toFixed(2));
        handleCrash(newCrashPoint);
        return;
      }
      
      // Продолжаем цикл с более высокой частотой обновления
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
  }, [generateCrashPoint, hasBet, userBet, autoCashOut, cashedOut, handleCrash, clearAllTimers]);
  
  // Размещение ставки
  const handlePlaceBet = useCallback(async () => {
    if (loading || hasBet || betAmount <= 0 || betAmount > balance || gameState !== 'waiting') {
      console.log('КРАШ: Ставка заблокирована');
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('КРАШ: Размещаем ставку', betAmount);
      
      // Имитация API вызова (сократили время с 300 до 150 мс)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Создаем ставку
      const newBet = {
        id: Date.now(),
        amount: betAmount,
        autoCashOut: autoCashOut,
        username: 'Вы',
        isCurrentUser: true
      };
      
      setUserBet(newBet);
      setHasBet(true);
      setBalance(prev => prev - betAmount);
      
      console.log('КРАШ: Ставка размещена успешно', newBet);
    } catch (err) {
      console.error('КРАШ: Ошибка размещения ставки:', err);
      setError('Ошибка размещения ставки');
    } finally {
      setLoading(false);
    }
  }, [loading, hasBet, betAmount, balance, gameState, autoCashOut, setBalance, setError]);
  
  // Вывод ставки
  const handleCashOut = useCallback(async () => {
    if (!userBet || cashedOut || gameState !== 'flying') {
      console.log('КРАШ: Вывод заблокирован');
      return;
    }
    
    try {
      setLoading(true);
      
      const winAmount = userBet.amount * currentMultiplier;
      const profit = winAmount - userBet.amount;
      
      console.log('КРАШ: Выводим ставку, выигрыш:', winAmount.toFixed(2));
      
      setCashedOut(true);
      setBalance(prev => prev + winAmount);
      
      // Перемещаем ставку в выведенные
      setCashedOutBets(prev => [...prev, {
        ...userBet,
        cashOutMultiplier: currentMultiplier,
        winAmount: winAmount
      }]);
      
      setActiveBets(prev => prev.filter(bet => !bet.isCurrentUser));
      
      setGameResult({
        win: true,
        amount: profit,
        newBalance: balance + winAmount
      });
      
      console.log('КРАШ: Вывод выполнен успешно');
    } catch (err) {
      console.error('КРАШ: Ошибка вывода:', err);
      setError('Ошибка вывода ставки');
    } finally {
      setLoading(false);
    }
  }, [userBet, cashedOut, gameState, currentMultiplier, balance, setBalance, setGameResult, setError]);
  
  // Инициализация игры
  useEffect(() => {
    console.log('КРАШ: Инициализация игры');
    startWaitingPhase();
    
    return () => {
      console.log('КРАШ: Очистка ресурсов при размонтировании');
      clearAllTimers();
    };
  }, []); // Убираем зависимости, чтобы избежать повторных вызовов
  
  return (
    <div className="crash-game">
      {/* График */}
      <CrashGraph 
        multiplier={currentMultiplier}
        gameState={gameState}
        crashPoint={crashPoint}
        timeToStart={timeToStart}
      />
      
      {/* Элементы управления */}
      <CrashControls 
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        autoCashOut={autoCashOut}
        setAutoCashOut={setAutoCashOut}
        onPlaceBet={handlePlaceBet}
        onCashOut={handleCashOut}
        balance={balance}
        gameState={gameState}
        hasBet={hasBet}
        cashedOut={cashedOut}
        userBet={userBet}
        loading={loading}
        currentMultiplier={currentMultiplier}
      />
      
      <div className="crash-info-panels">
        {/* Список активных ставок */}
        <CrashBetsList 
          activeBets={activeBets}
          cashedOutBets={cashedOutBets}
          gameState={gameState}
        />
        
        {/* История раундов */}
        <CrashHistory 
          history={roundHistory}
        />
      </div>
    </div>
  );
};

export default CrashGame;
