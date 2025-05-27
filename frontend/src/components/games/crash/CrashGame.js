// frontend/src/components/games/crash/CrashGame.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CrashGraph from './CrashGraph';
import CrashControls from './CrashControls';
import CrashBetsList from './CrashBetsList';
import CrashHistory from './CrashHistory';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import { gameApi } from '../../../services';
import '../../../styles/CrashGame.css';

const CrashGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError 
}) => {
  // Добавляем тактильную обратную связь
  const { 
    gameActionFeedback, 
    importantActionFeedback, 
    criticalActionFeedback,
    gameWinFeedback,
    gameLoseFeedback 
  } = useTactileFeedback();

  // НОВОЕ: Состояние загрузки
  const [isInitializing, setIsInitializing] = useState(true);
  
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
  
  // ИСПРАВЛЕНО: Более надежные рефы для таймеров
  const gameTimerRef = useRef(null);
  const multiplierTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isCrashedRef = useRef(false);
  const roundIdRef = useRef(0);
  const lastMultiplierUpdateRef = useRef(0);
  const isGameActiveRef = useRef(false); // НОВЫЙ РЕФ для отслеживания активности игры
  
  // НОВОЕ: Инициализация с загрузочным экраном
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Показываем загрузочный экран минимум 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ КРАШ ИГРЫ ===');
        setIsInitializing(false);
        
        // Запускаем первый раунд
        setTimeout(() => {
          startWaitingPeriod();
        }, 500);
        
      } catch (err) {
        console.error('Ошибка инициализации:', err);
        setError('Ошибка загрузки игры');
        setIsInitializing(false);
      }
    };
    
    initializeGame();
    
    return () => {
      cleanupAllTimers();
    };
  }, []);
  
  // Генерация краш-поинта (реальная логика должна быть на сервере)
  const generateCrashPoint = useCallback(() => {
    const random = Math.random();
    if (random < 0.4) return 1.0 + Math.random() * 0.8; // 1.0-1.8x (40%)
    if (random < 0.7) return 1.8 + Math.random() * 1.2; // 1.8-3.0x (30%)
    if (random < 0.9) return 3.0 + Math.random() * 4.0; // 3.0-7.0x (20%)
    return 7.0 + Math.random() * 13.0; // 7.0-20.0x (10%)
  }, []);
  
  // ИСПРАВЛЕНО: Надежная очистка всех таймеров
  const cleanupAllTimers = useCallback(() => {
    console.log('🧹 Очистка всех таймеров');
    
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    if (multiplierTimerRef.current) {
      clearInterval(multiplierTimerRef.current);
      multiplierTimerRef.current = null;
    }
    
    isGameActiveRef.current = false;
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
      console.log('✅ Ставка размещена:', betAmount, 'USDT');
      
    } catch (err) {
      console.error('❌ Ошибка размещения ставки:', err);
      setError(err.response?.data?.message || 'Ошибка размещения ставки');
      setLoading(false);
    }
  }, [gameState, hasBet, betAmount, balance, loading, autoCashOut, setBalance, setError]);
  
  // ИСПРАВЛЕНО: Кешаут который НЕ ломает игру
  const cashOut = useCallback(async () => {
    if (gameState !== 'flying' || !hasBet || cashedOut || loading || isCrashedRef.current) {
      console.log('❌ Кешаут заблокирован:', { gameState, hasBet, cashedOut, loading, crashed: isCrashedRef.current });
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('💰 КЕШАУТ: Пользователь выводит при', currentMultiplier.toFixed(2), 'x');
      
      const winAmount = userBet.amount * currentMultiplier;
      setBalance(prev => prev + winAmount);
      setCashedOut(true);
      setUserCashOutMultiplier(currentMultiplier);
      
      // Убираем ставку пользователя из активных
      setActiveBets(prev => prev.filter(bet => !bet.isCurrentUser));
      
      // Добавляем в список выведенных ставок
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
      
      // Вибрация при успешном кешауте
      gameWinFeedback();
      
      setLoading(false);
      
      console.log('✅ КЕШАУТ: Завершен успешно, игра продолжается для всех остальных');
      
      // КРИТИЧЕСКИ ВАЖНО: НЕ ТРОГАЕМ ИГРОВЫЕ ТАЙМЕРЫ!
      // Игра должна продолжаться независимо от действий пользователя
      
    } catch (err) {
      console.error('❌ Ошибка кешаута:', err);
      setError(err.response?.data?.message || 'Ошибка вывода ставки');
      setLoading(false);
    }
  }, [gameState, hasBet, cashedOut, loading, currentMultiplier, userBet, balance, setBalance, setError, setGameResult, gameWinFeedback]);
  
  // Автоматический кешаут
  useEffect(() => {
    if (gameState === 'flying' && 
        hasBet && 
        !cashedOut && 
        !isCrashedRef.current &&
        userBet?.autoCashOut > 0 && 
        currentMultiplier >= userBet.autoCashOut) {
      console.log('🤖 АВТОКЕШАУТ: сработал при', currentMultiplier.toFixed(2), 'x');
      cashOut();
    }
  }, [gameState, hasBet, cashedOut, userBet, currentMultiplier, cashOut]);
  
  // ИСПРАВЛЕНО: Период ожидания с точным таймингом
  const startWaitingPeriod = useCallback(() => {
    console.log('⏳ === НАЧАЛО ПЕРИОДА ОЖИДАНИЯ ===');
    
    // Сбрасываем все состояния
    cleanupAllTimers();
    setGameState('waiting');
    setTimeToStart(7); // ТОЧНО 7 секунд
    setCurrentMultiplier(1.00);
    isCrashedRef.current = false;
    isGameActiveRef.current = false;
    
    // Очищаем данные предыдущего раунда
    setHasBet(false);
    setCashedOut(false);
    setUserBet(null);
    setUserCashOutMultiplier(0);
    setActiveBets([]);
    setCashedOutBets([]);
    
    // ИСПРАВЛЕНО: Точный таймер обратного отсчета
    let countdown = 7;
    setTimeToStart(countdown);
    
    gameTimerRef.current = setInterval(() => {
      countdown -= 1;
      setTimeToStart(countdown);
      
      console.log('⏰ Обратный отсчет:', countdown);
      
      if (countdown <= 0) {
        clearInterval(gameTimerRef.current);
        gameTimerRef.current = null;
        
        console.log('🚀 Время ожидания истекло, запускаем полет');
        startFlyingPhase();
      }
    }, 1000); // ТОЧНО 1 секунда
    
  }, [cleanupAllTimers]);
  
  // ИСПРАВЛЕНО: Фаза полета с правильной скоростью
  const startFlyingPhase = useCallback(() => {
    console.log('🚀 === НАЧАЛО ФАЗЫ ПОЛЕТА ===');
    
    // Очищаем таймеры ожидания
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    
    // Генерируем новый краш-поинт
    const newCrashPoint = generateCrashPoint();
    setCrashPoint(newCrashPoint);
    roundIdRef.current += 1;
    
    console.log('🎯 Новый краш-поинт:', newCrashPoint.toFixed(2), 'x');
    console.log('🆔 ID раунда:', roundIdRef.current);
    
    // Устанавливаем состояние полета
    setGameState('flying');
    setCurrentMultiplier(1.00);
    startTimeRef.current = Date.now();
    lastMultiplierUpdateRef.current = Date.now();
    isCrashedRef.current = false;
    isGameActiveRef.current = true;
    
    // ИСПРАВЛЕНО: Замедленная логика роста множителя
    multiplierTimerRef.current = setInterval(() => {
      // Проверяем, что игра все еще активна
      if (!isGameActiveRef.current || isCrashedRef.current) {
        return;
      }
      
      const now = Date.now();
      const totalElapsed = (now - startTimeRef.current) / 1000; // Общее время с начала
      const deltaTime = (now - lastMultiplierUpdateRef.current) / 1000; // Время с последнего обновления
      lastMultiplierUpdateRef.current = now;
      
      // ЗАМЕДЛЕННАЯ ФОРМУЛА: Более медленный рост множителя
      const baseSpeed = 0.06; // УМЕНЬШЕНО с 0.1 до 0.06 (на 40% медленнее)
      const acceleration = 0.03; // УМЕНЬШЕНО с 0.05 до 0.03 (на 40% медленнее)
      const speedIncrease = baseSpeed + (acceleration * totalElapsed);
      
      // Рассчитываем новый множитель
      const multiplierIncrease = speedIncrease * deltaTime;
      
      setCurrentMultiplier(prevMultiplier => {
        const newMultiplier = prevMultiplier + multiplierIncrease;
        
        // ПРОВЕРЯЕМ КРАШ
        if (newMultiplier >= newCrashPoint) {
          console.log('💥 === КРАШ ПРИ', newCrashPoint.toFixed(2), 'x ===');
          
          // Останавливаем игру
          isCrashedRef.current = true;
          isGameActiveRef.current = false;
          
          clearInterval(multiplierTimerRef.current);
          multiplierTimerRef.current = null;
          
          // Переходим в состояние краха
          setGameState('crashed');
          
          // Добавляем в историю
          setHistory(prev => [{
            roundId: roundIdRef.current,
            crashPoint: newCrashPoint,
            timestamp: Date.now(),
            totalBets: Math.floor(Math.random() * 15) + 1,
            totalAmount: Math.random() * 800 + 100
          }, ...prev.slice(0, 19)]);
          
          // Если у пользователя была ставка и он не вывел
          if (hasBet && !cashedOut) {
            gameLoseFeedback(); // Вибрация при проигрыше
            setGameResult({
              win: false,
              amount: userBet.amount,
              newBalance: balance
            });
          }
          
          // ТОЧНО через 3 секунды запускаем новый период ожидания
          setTimeout(() => {
            console.log('🔄 Переходим к новому раунду');
            startWaitingPeriod();
          }, 3000); // ТОЧНО 3 секунды
          
          return newCrashPoint; // Возвращаем точный краш-поинт
        } else {
          // Множитель продолжает расти
          return newMultiplier;
        }
      });
    }, 80); // ЗАМЕДЛЕНО с 50ms до 80ms (на 60% медленнее обновления)
    
  }, [generateCrashPoint, hasBet, cashedOut, userBet, balance, setGameResult, startWaitingPeriod, gameLoseFeedback]);
  
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
  
  // Обработчик главной кнопки с тактильной обратной связью
  const handleMainButtonClick = () => {
    if (loading) return;
    
    switch (gameState) {
      case 'waiting':
        if (!hasBet) {
          gameActionFeedback(); // Вибрация при размещении ставки
          placeBet();
        }
        break;
      case 'flying':
        if (hasBet && !cashedOut) {
          criticalActionFeedback(); // Сильная вибрация при кешауте
          cashOut();
        }
        break;
      default:
        break;
    }
  };
  
  // НОВОЕ: Загрузочный экран
  if (isInitializing) {
    return (
      <div className="crash-loading-screen">
        <div className="crash-loading-content">
          <div className="greenlight-logo">
            <div className="logo-icon">🚀</div>
            <div className="logo-text">Greenlight</div>
            <div className="logo-subtitle">Crash Game</div>
          </div>
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <div className="loading-text">Загрузка игры...</div>
        </div>
      </div>
    );
  }
  
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
      
      {/* Главная кнопка действия с тактильной обратной связью */}
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
