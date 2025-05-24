// frontend/src/components/games/crash/CrashGame.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CrashGraph from './CrashGraph';
import CrashControls from './CrashControls';
import CrashBetsList from './CrashBetsList';
import CrashHistory from './CrashHistory';
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
  const [timeToStart, setTimeToStart] = useState(7);
  const [crashPoint, setCrashPoint] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Состояние ставки пользователя
  const [betAmount, setBetAmount] = useState(10);
  const [autoCashOut, setAutoCashOut] = useState(2.0);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [userBet, setUserBet] = useState(null);
  const [userCashOutMultiplier, setUserCashOutMultiplier] = useState(0);
  
  // Ставки других игроков (мок данные)
  const [activeBets, setActiveBets] = useState([]);
  const [cashedOutBets, setCashedOutBets] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Рефы для таймеров и состояния
  const gameTimerRef = useRef(null);
  const multiplierTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isCrashedRef = useRef(false);
  const roundIdRef = useRef(0);
  
  // Генерация краш-поинта (реальная логика должна быть на сервере)
  const generateCrashPoint = useCallback(() => {
    const random = Math.random();
    if (random < 0.33) return 1.0 + Math.random() * 0.5; // 1.0-1.5x (33%)
    if (random < 0.66) return 1.5 + Math.random() * 1.5; // 1.5-3.0x (33%)
    return 3.0 + Math.random() * 7.0; // 3.0-10.0x (34%)
  }, []);
  
  // Размещение ставки
  const placeBet = useCallback(async () => {
    if (gameState !== 'waiting' || hasBet || betAmount <= 0 || betAmount > balance || loading) {
      return;
    }
    
    try {
      setLoading(true);
      
      setBalance(prev => prev - betAmount);
      setHasBet(true);
      setCashedOut(false);
      setUserBet({
        amount: betAmount,
        autoCashOut: autoCashOut
      });
      
      setActiveBets(prev => [...prev, {
        id: Date.now(),
        amount: betAmount,
        autoCashOut: autoCashOut,
        username: 'Вы',
        userId: 'current-user',
        isCurrentUser: true
      }]);
      
      setLoading(false);
    } catch (err) {
      console.error('Ошибка размещения ставки:', err);
      setError(err.response?.data?.message || 'Ошибка размещения ставки');
      setLoading(false);
    }
  }, [gameState, hasBet, betAmount, balance, loading, autoCashOut, setBalance, setError]);
  
  // Ручной кешаут
  const cashOut = useCallback(async () => {
    if (gameState !== 'flying' || !hasBet || cashedOut || loading || isCrashedRef.current) {
      return;
    }
    
    try {
      setLoading(true);
      
      const winAmount = userBet.amount * currentMultiplier;
      setBalance(prev => prev + winAmount);
      setCashedOut(true);
      setUserCashOutMultiplier(currentMultiplier);
      
      setActiveBets(prev => prev.filter(bet => !bet.isCurrentUser));
      setCashedOutBets(prev => [...prev, {
        id: Date.now(),
        amount: userBet.amount,
        autoCashOut: userBet.autoCashOut,
        username: 'Вы',
        userId: 'current-user',
        isCurrentUser: true,
        cashOutMultiplier: currentMultiplier,
        winAmount: winAmount
      }]);
      
      setGameResult({
        win: true,
        amount: winAmount - userBet.amount,
        newBalance: balance + winAmount
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Ошибка кешаута:', err);
      setError(err.response?.data?.message || 'Ошибка вывода ставки');
      setLoading(false);
    }
  }, [gameState, hasBet, cashedOut, loading, currentMultiplier, userBet, balance, setBalance, setError, setGameResult]);
  
  // Автоматический кешаут
  useEffect(() => {
    if (gameState === 'flying' && 
        hasBet && 
        !cashedOut && 
        !isCrashedRef.current &&
        userBet?.autoCashOut > 0 && 
        currentMultiplier >= userBet.autoCashOut) {
      cashOut();
    }
  }, [gameState, hasBet, cashedOut, userBet, currentMultiplier, cashOut]);
  
  // Очистка всех таймеров
  const clearAllTimers = useCallback(() => {
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    if (multiplierTimerRef.current) {
      clearInterval(multiplierTimerRef.current);
      multiplierTimerRef.current = null;
    }
  }, []);
  
  // Запуск нового раунда
  const startNewRound = useCallback(() => {
    console.log('Запуск нового раунда');
    
    // Очищаем все таймеры
    clearAllTimers();
    
    // Сбрасываем флаги
    isCrashedRef.current = false;
    roundIdRef.current += 1;
    
    // Генерируем новый краш-поинт
    const newCrashPoint = generateCrashPoint();
    setCrashPoint(newCrashPoint);
    
    // Сбрасываем состояние
    setCurrentMultiplier(1.00);
    setGameState('flying');
    startTimeRef.current = Date.now();
    
    // Очищаем списки ставок
    setActiveBets([]);
    setCashedOutBets([]);
    
    // Запускаем таймер множителя
    multiplierTimerRef.current = setInterval(() => {
      // Проверяем, что игра еще не завершилась
      if (isCrashedRef.current) {
        return;
      }
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const newMultiplier = 1.00 + elapsed * 0.1;
      
      if (newMultiplier >= newCrashPoint) {
        // КРАШ! Останавливаем все
        isCrashedRef.current = true;
        clearInterval(multiplierTimerRef.current);
        multiplierTimerRef.current = null;
        
        setCurrentMultiplier(newCrashPoint);
        setGameState('crashed');
        
        // Добавляем в историю
        setHistory(prev => [{
          roundId: roundIdRef.current,
          crashPoint: newCrashPoint,
          timestamp: Date.now(),
          totalBets: Math.floor(Math.random() * 10) + 1,
          totalAmount: Math.random() * 500 + 50
        }, ...prev.slice(0, 19)]);
        
        // Если у пользователя была ставка и он не вывел
        if (hasBet && !cashedOut) {
          setGameResult({
            win: false,
            amount: userBet.amount,
            newBalance: balance
          });
        }
        
        // Через 3 секунды запускаем новый таймер ожидания
        setTimeout(() => {
          setGameState('waiting');
          setTimeToStart(7);
          setHasBet(false);
          setCashedOut(false);
          setUserBet(null);
          setUserCashOutMultiplier(0);
          
          // Запускаем обратный отсчет
          gameTimerRef.current = setInterval(() => {
            setTimeToStart(prev => {
              if (prev <= 1) {
                clearInterval(gameTimerRef.current);
                gameTimerRef.current = null;
                startNewRound();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }, 3000);
      } else {
        setCurrentMultiplier(newMultiplier);
      }
    }, 100);
  }, [generateCrashPoint, hasBet, cashedOut, userBet, balance, setGameResult, clearAllTimers]);
  
  // Инициализация игры
  useEffect(() => {
    roundIdRef.current = 0;
    
    // Запускаем первый таймер ожидания
    gameTimerRef.current = setInterval(() => {
      setTimeToStart(prev => {
        if (prev <= 1) {
          clearInterval(gameTimerRef.current);
          gameTimerRef.current = null;
          startNewRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      clearAllTimers();
    };
  }, [startNewRound, clearAllTimers]);
  
  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);
  
  // Получение текста для главной кнопки
  const getMainButtonText = () => {
    if (loading) return 'Загрузка...';
    
    switch (gameState) {
      case 'waiting':
        if (hasBet) return `Ставка размещена (${userBet?.amount} USDT)`;
        return `Поставить ${betAmount} USDT`;
      case 'flying':
        if (!hasBet) return 'Ставка не размещена';
        if (cashedOut) return `Выведено при ${userCashOutMultiplier.toFixed(2)}x`;
        return `Вывести (${(userBet.amount * currentMultiplier).toFixed(2)} USDT)`;
      case 'crashed':
        if (hasBet && !cashedOut) return 'Проигрыш';
        if (hasBet && cashedOut) return `Выигрыш ${userCashOutMultiplier.toFixed(2)}x`;
        return 'Раунд завершен';
      default:
        return 'Ошибка состояния';
    }
  };
  
  // Получение класса для главной кнопки
  const getMainButtonClass = () => {
    if (loading) return 'loading';
    
    switch (gameState) {
      case 'waiting':
        if (hasBet) return 'placed';
        return 'bet';
      case 'flying':
        if (!hasBet) return 'disabled';
        if (cashedOut) return 'won';
        return 'cashout';
      case 'crashed':
        if (hasBet && !cashedOut) return 'lost';
        if (hasBet && cashedOut) return 'won';
        return 'disabled';
      default:
        return 'disabled';
    }
  };
  
  // Обработчик главной кнопки
  const handleMainButtonClick = () => {
    if (loading) return;
    
    switch (gameState) {
      case 'waiting':
        if (!hasBet) placeBet();
        break;
      case 'flying':
        if (hasBet && !cashedOut) cashOut();
        break;
      default:
        break;
    }
  };
  
  return (
    <div className={`crash-game ${loading ? 'loading' : ''}`} data-game-state={gameState}>
      {/* График */}
      <CrashGraph 
        multiplier={currentMultiplier}
        gameState={gameState}
        crashPoint={crashPoint}
        timeToStart={timeToStart}
        roundId={roundIdRef.current}
      />
      
      {/* Главная кнопка действия */}
      <button 
        className={`crash-main-action-btn ${getMainButtonClass()}`}
        onClick={handleMainButtonClick}
        disabled={loading || (gameState === 'waiting' && hasBet) || (gameState === 'flying' && (!hasBet || cashedOut)) || gameState === 'crashed'}
      >
        {getMainButtonText()}
      </button>
      
      {/* Панель управления */}
      <CrashControls 
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        autoCashOut={autoCashOut}
        setAutoCashOut={setAutoCashOut}
        balance={balance}
        gameState={gameState}
        hasBet={hasBet}
        cashedOut={cashedOut}
        userBet={userBet}
        userCashOutMultiplier={userCashOutMultiplier}
        loading={loading}
        currentMultiplier={currentMultiplier}
      />
      
      {/* Информационные панели */}
      <div className="crash-info-panels">
        <CrashBetsList 
          activeBets={activeBets}
          cashedOutBets={cashedOutBets}
          gameState={gameState}
        />
        
        <CrashHistory 
          history={history}
        />
      </div>
    </div>
  );
};

export default CrashGame;
