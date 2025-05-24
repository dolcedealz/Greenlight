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
  const [timeToStart, setTimeToStart] = useState(7);
  
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
  const gameTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isGameRunningRef = useRef(false);
  
  // Очистка таймеров
  const clearTimers = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
  }, []);
  
  // Генерация случайного краш-поинта
  const generateCrashPoint = useCallback(() => {
    // Используем формулу для краш-игр: 99/(random * 99) где random от 0.01 до 0.99
    const random = Math.random() * 0.98 + 0.01; // от 0.01 до 0.99
    const crashPoint = Math.max(1.01, 99 / (random * 99));
    return Math.min(crashPoint, 100); // Ограничиваем максимум 100x
  }, []);
  
  // Запуск нового раунда
  const startNewRound = useCallback(() => {
    console.log('КРАШ: Запуск нового раунда');
    
    clearTimers();
    
    // Генерируем новый краш-поинт
    const newCrashPoint = generateCrashPoint();
    
    // Сбрасываем состояние
    setGameState('flying');
    setCurrentMultiplier(1.00);
    setCrashPoint(newCrashPoint);
    setRoundId(prev => prev + 1);
    setCashedOut(false);
    setActiveBets([]);
    setCashedOutBets([]);
    
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
    
    const updateMultiplier = () => {
      if (!isGameRunningRef.current || gameState === 'crashed') {
        return;
      }
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      
      // Экспоненциальная формула роста множителя
      const multiplier = Math.pow(Math.E, 0.00006 * elapsed * elapsed);
      const currentMult = Math.max(1.00, multiplier);
      
      setCurrentMultiplier(currentMult);
      
      // Проверяем автовывод
      if (hasBet && !cashedOut && autoCashOut > 0 && currentMult >= autoCashOut) {
        handleCashOut();
        return;
      }
      
      // Проверяем краш
      if (currentMult >= newCrashPoint) {
        handleCrash(newCrashPoint);
        return;
      }
      
      gameLoopRef.current = requestAnimationFrame(updateMultiplier);
    };
    
    updateMultiplier();
  }, [gameState, hasBet, userBet, autoCashOut, cashedOut, generateCrashPoint]);
  
  // Обработка краха
  const handleCrash = useCallback((crashPoint) => {
    console.log('КРАШ: Игра крашнулась на', crashPoint.toFixed(2) + 'x');
    
    clearTimers();
    isGameRunningRef.current = false;
    
    setGameState('crashed');
    setCurrentMultiplier(crashPoint);
    setCrashPoint(crashPoint);
    
    // Добавляем в историю
    const roundData = {
      roundId: roundId,
      crashPoint: crashPoint,
      timestamp: Date.now(),
      totalBets: activeBets.length,
      totalAmount: activeBets.reduce((sum, bet) => sum + bet.amount, 0)
    };
    
    setRoundHistory(prev => [roundData, ...prev.slice(0, 19)]);
    
    // Проверяем результат пользователя
    if (hasBet && !cashedOut) {
      console.log('КРАШ: Пользователь проиграл');
      setGameResult({
        win: false,
        amount: userBet.amount,
        newBalance: balance
      });
    }
    
    // Сбрасываем ставку через 2 секунды и запускаем таймер ожидания
    setTimeout(() => {
      setHasBet(false);
      setUserBet(null);
      setCashedOut(false);
      startWaitingPeriod();
    }, 2000);
  }, [roundId, activeBets, hasBet, cashedOut, userBet, balance, setGameResult]);
  
  // Период ожидания между играми
  const startWaitingPeriod = useCallback(() => {
    console.log('КРАШ: Начало периода ожидания');
    
    setGameState('waiting');
    setTimeToStart(7);
    
    gameTimerRef.current = setInterval(() => {
      setTimeToStart(prev => {
        if (prev <= 1) {
          clearInterval(gameTimerRef.current);
          setTimeout(startNewRound, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [startNewRound]);
  
  // Размещение ставки
  const handlePlaceBet = useCallback(async () => {
    if (loading || hasBet || betAmount <= 0 || betAmount > balance || gameState !== 'waiting') {
      return;
    }
    
    try {
      setLoading(true);
      
      // Имитация API вызова (можно заменить на реальный)
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      return;
    }
    
    try {
      setLoading(true);
      
      const winAmount = userBet.amount * currentMultiplier;
      const profit = winAmount - userBet.amount;
      
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
      
      console.log('КРАШ: Вывод выполнен успешно', winAmount.toFixed(2));
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
    startWaitingPeriod();
    
    return () => {
      console.log('КРАШ: Очистка ресурсов');
      clearTimers();
      isGameRunningRef.current = false;
    };
  }, [startWaitingPeriod]);
  
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      clearTimers();
      isGameRunningRef.current = false;
    };
  }, [clearTimers]);
  
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
