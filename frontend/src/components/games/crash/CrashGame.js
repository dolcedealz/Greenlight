// frontend/src/components/games/crash/CrashGame.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CrashGraph from './CrashGraph';
import CrashControls from './CrashControls';
import CrashHistory from './CrashHistory';
import CrashBetsList from './CrashBetsList';
import { gameApi } from '../../../services';
import socket from '../../../services/socket';
import '../../../styles/CrashGame.css';

const CrashGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError 
}) => {
  // Состояние игры
  const [gameState, setGameState] = useState('waiting'); // waiting, betting, flying, crashed
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [timeToStart, setTimeToStart] = useState(0);
  
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
  
  // WebSocket и анимация
  const gameLoopRef = useRef(null);
  const startTimeRef = useRef(null);
  const isConnectedRef = useRef(false);
  
  // Подключение к WebSocket
  useEffect(() => {
    console.log('КРАШ: Подключаемся к WebSocket');
    
    socket.connect();
    
    // Присоединяемся к комнате краш игры
    socket.emit('join-crash-room');
    
    // Обработчики WebSocket событий
    socket.subscribe('crash-game-state', handleGameStateUpdate);
    socket.subscribe('crash-round-start', handleRoundStart);
    socket.subscribe('crash-round-end', handleRoundEnd);
    socket.subscribe('crash-multiplier-update', handleMultiplierUpdate);
    socket.subscribe('crash-bet-placed', handleBetPlaced);
    socket.subscribe('crash-bet-cashed-out', handleBetCashedOut);
    socket.subscribe('crash-waiting-timer', handleWaitingTimer);
    
    isConnectedRef.current = true;
    
    // Запрашиваем текущее состояние игры
    socket.emit('get-crash-state');
    
    return () => {
      console.log('КРАШ: Отключаемся от WebSocket');
      
      socket.unsubscribe('crash-game-state', handleGameStateUpdate);
      socket.unsubscribe('crash-round-start', handleRoundStart);
      socket.unsubscribe('crash-round-end', handleRoundEnd);
      socket.unsubscribe('crash-multiplier-update', handleMultiplierUpdate);
      socket.unsubscribe('crash-bet-placed', handleBetPlaced);
      socket.unsubscribe('crash-bet-cashed-out', handleBetCashedOut);
      socket.unsubscribe('crash-waiting-timer', handleWaitingTimer);
      
      socket.emit('leave-crash-room');
      socket.disconnect();
      
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      
      isConnectedRef.current = false;
    };
  }, []);
  
  // Обработчики WebSocket событий
  const handleGameStateUpdate = useCallback((data) => {
    console.log('КРАШ: Обновление состояния игры:', data);
    
    setGameState(data.state);
    setRoundId(data.roundId);
    setCurrentMultiplier(data.multiplier || 1.00);
    setCrashPoint(data.crashPoint);
    setActiveBets(data.bets || []);
    setCashedOutBets(data.cashedOutBets || []);
    
    if (data.userBet) {
      setUserBet(data.userBet);
      setHasBet(true);
      setCashedOut(data.userBet.cashedOut || false);
    } else {
      setUserBet(null);
      setHasBet(false);
      setCashedOut(false);
    }
    
    if (data.state === 'flying') {
      startTimeRef.current = Date.now() - (data.elapsed || 0);
      startGameLoop();
    }
  }, []);
  
  const handleRoundStart = useCallback((data) => {
    console.log('КРАШ: Начало раунда:', data);
    
    setGameState('flying');
    setRoundId(data.roundId);
    setCurrentMultiplier(1.00);
    setCrashPoint(null);
    setCashedOut(false);
    startTimeRef.current = Date.now();
    
    startGameLoop();
  }, []);
  
  const handleRoundEnd = useCallback((data) => {
    console.log('КРАШ: Конец раунда:', data);
    
    setGameState('crashed');
    setCrashPoint(data.crashPoint);
    setCurrentMultiplier(data.crashPoint);
    
    // Обновляем историю
    setRoundHistory(prev => [data, ...prev.slice(0, 19)]); // Храним последние 20 раундов
    
    // Проверяем результат пользователя
    if (userBet && !cashedOut) {
      // Пользователь проиграл
      setGameResult({
        win: false,
        amount: userBet.amount,
        newBalance: balance
      });
    }
    
    // Обновляем баланс если есть изменения
    if (data.newBalance !== undefined) {
      setBalance(data.newBalance);
    }
    
    // Сбрасываем состояние ставки
    setTimeout(() => {
      setHasBet(false);
      setUserBet(null);
      setCashedOut(false);
      setGameState('waiting');
    }, 3000);
    
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  }, [userBet, cashedOut, balance, setBalance, setGameResult]);
  
  const handleMultiplierUpdate = useCallback((data) => {
    setCurrentMultiplier(data.multiplier);
  }, []);
  
  const handleBetPlaced = useCallback((data) => {
    console.log('КРАШ: Размещена ставка:', data);
    
    setActiveBets(prev => [...prev, data.bet]);
    
    // Если это ставка текущего пользователя
    if (data.bet.isCurrentUser) {
      setUserBet(data.bet);
      setHasBet(true);
      setBalance(data.newBalance);
    }
  }, [setBalance]);
  
  const handleBetCashedOut = useCallback((data) => {
    console.log('КРАШ: Ставка выведена:', data);
    
    setActiveBets(prev => prev.filter(bet => bet.id !== data.bet.id));
    setCashedOutBets(prev => [...prev, data.bet]);
    
    // Если это ставка текущего пользователя
    if (data.bet.isCurrentUser) {
      setCashedOut(true);
      setBalance(data.newBalance);
      
      setGameResult({
        win: true,
        amount: data.bet.winAmount - data.bet.amount,
        newBalance: data.newBalance
      });
    }
  }, [setBalance, setGameResult]);
  
  const handleWaitingTimer = useCallback((data) => {
    setTimeToStart(data.timeToStart);
  }, []);
  
  // Игровой цикл для плавной анимации
  const startGameLoop = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    
    const updateMultiplier = () => {
      if (!startTimeRef.current || gameState !== 'flying') {
        return;
      }
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      
      // Формула роста: экспоненциальная кривая
      const multiplier = Math.pow(Math.E, 0.00006 * elapsed * elapsed);
      
      setCurrentMultiplier(Math.max(1.00, multiplier));
      
      // Проверяем автовывод
      if (userBet && !cashedOut && autoCashOut > 0 && multiplier >= autoCashOut) {
        handleCashOut();
        return;
      }
      
      gameLoopRef.current = requestAnimationFrame(updateMultiplier);
    };
    
    updateMultiplier();
  }, [gameState, userBet, cashedOut, autoCashOut]);
  
  // Размещение ставки
  const handlePlaceBet = useCallback(async () => {
    if (loading || hasBet || betAmount <= 0 || betAmount > balance || gameState !== 'waiting') {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await gameApi.placeCrashBet(betAmount, autoCashOut);
      
      if (response.data.success) {
        // Ставка будет обновлена через WebSocket
        console.log('КРАШ: Ставка размещена успешно');
      }
    } catch (err) {
      console.error('КРАШ: Ошибка размещения ставки:', err);
      setError(err.response?.data?.message || 'Ошибка размещения ставки');
    } finally {
      setLoading(false);
    }
  }, [loading, hasBet, betAmount, balance, gameState, autoCashOut, setError]);
  
  // Вывод ставки
  const handleCashOut = useCallback(async () => {
    if (!userBet || cashedOut || gameState !== 'flying') {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await gameApi.crashCashOut(roundId);
      
      if (response.data.success) {
        // Результат будет обновлен через WebSocket
        console.log('КРАШ: Вывод выполнен успешно');
      }
    } catch (err) {
      console.error('КРАШ: Ошибка вывода:', err);
      setError(err.response?.data?.message || 'Ошибка вывода ставки');
    } finally {
      setLoading(false);
    }
  }, [userBet, cashedOut, gameState, roundId, setError]);
  
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