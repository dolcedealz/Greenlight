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
  const lastMultiplierUpdateRef = useRef(0);
  
  // НОВОЕ: Функция для получения CSS класса графика на основе множителя
  const getGraphCSSClass = useCallback(() => {
    if (gameState !== 'flying') return '';
    
    if (currentMultiplier >= 15) {
      return 'legendary-multiplier';
    } else if (currentMultiplier >= 8) {
      return 'high-multiplier';
    } else if (currentMultiplier >= 5) {
      return 'critical-moment';
    }
    
    return '';
  }, [gameState, currentMultiplier]);
  
  // Генерация краш-поинта (реальная логика должна быть на сервере)
  const generateCrashPoint = useCallback(() => {
    const random = Math.random();
    if (random < 0.4) return 1.0 + Math.random() * 0.8; // 1.0-1.8x (40%)
    if (random < 0.7) return 1.8 + Math.random() * 1.2; // 1.8-3.0x (30%)
    if (random < 0.9) return 3.0 + Math.random() * 4.0; // 3.0-7.0x (20%)
    return 7.0 + Math.random() * 13.0; // 7.0-20.0x (10%)
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
  
  // КРИТИЧЕСКИ ВАЖНО: Кешаут НЕ влияет на игру
  const cashOut = useCallback(async () => {
    if (gameState !== 'flying' || !hasBet || cashedOut || loading || isCrashedRef.current) {
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('КЕШАУТ: Пользователь выводит при', currentMultiplier, '- игра ПРОДОЛЖАЕТСЯ');
      
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
      
      setLoading(false);
      
      console.log('КЕШАУТ: Завершен успешно, игра продолжается для всех остальных');
      
      // ВАЖНО: НЕ ТРОГАЕМ ИГРОВЫЕ ТАЙМЕРЫ И СОСТОЯНИЯ!
      // multiplierTimerRef.current продолжает работать
      // currentMultiplier продолжает расти
      // gameState остается 'flying'
      // График продолжает лететь
      
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
      console.log('АВТОКЕШАУТ: сработал при', currentMultiplier, '- игра продолжается');
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
  
  // ИСПРАВЛЕНО: Более плавная и быстрая логика роста множителя
  const startNewRound = useCallback(() => {
    console.log('=== ЗАПУСК НОВОГО РАУНДА ===');
    
    // Очищаем все таймеры
    clearAllTimers();
    
    // Сбрасываем флаги
    isCrashedRef.current = false;
    roundIdRef.current += 1;
    
    // Генерируем новый краш-поинт
    const newCrashPoint = generateCrashPoint();
    setCrashPoint(newCrashPoint);
    console.log('НОВЫЙ КРАШ-ПОИНТ:', newCrashPoint);
    
    // Сбрасываем состояние для нового раунда
    setCurrentMultiplier(1.00);
    setGameState('flying');
    startTimeRef.current = Date.now();
    lastMultiplierUpdateRef.current = Date.now();
    
    // Очищаем списки ставок для нового раунда
    setActiveBets([]);
    setCashedOutBets([]);
    
    // ИСПРАВЛЕННАЯ логика роста множителя с плавным ускорением
    multiplierTimerRef.current = setInterval(() => {
      // Проверяем, что игра еще не завершилась
      if (isCrashedRef.current) {
        return;
      }
      
      const now = Date.now();
      const totalElapsed = (now - startTimeRef.current) / 1000; // Общее время с начала
      const deltaTime = (now - lastMultiplierUpdateRef.current) / 1000; // Время с последнего обновления
      lastMultiplierUpdateRef.current = now;
      
      // НОВАЯ ФОРМУЛА: Плавное ускорение пропорционально времени
      // Базовая скорость роста увеличивается с течением времени
      const baseSpeed = 0.1; // Начальная скорость роста множителя в секунду
      const acceleration = 0.05; // Ускорение роста во времени
      const speedIncrease = baseSpeed + (acceleration * totalElapsed); // Скорость растет со временем
      
      // Рассчитываем новый множитель
      const multiplierIncrease = speedIncrease * deltaTime;
      
      setCurrentMultiplier(prevMultiplier => {
        const newMultiplier = prevMultiplier + multiplierIncrease;
        
        // ПРОВЕРЯЕМ КРАШ НЕЗАВИСИМО ОТ КЕШАУТОВ ПОЛЬЗОВАТЕЛЕЙ
        if (newMultiplier >= newCrashPoint) {
          // КРАШ! Останавливаем ВСЮ игру
          console.log('=== КРАШ ПРИ', newCrashPoint.toFixed(2), '===');
          isCrashedRef.current = true;
          clearInterval(multiplierTimerRef.current);
          multiplierTimerRef.current = null;
          
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
            setGameResult({
              win: false,
              amount: userBet.amount,
              newBalance: balance
            });
          }
          
          // Через 3 секунды запускаем новый таймер ожидания
          setTimeout(() => {
            console.log('Переходим в режим ожидания следующего раунда');
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
          
          return newCrashPoint; // Возвращаем точный краш-поинт
        } else {
          // МНОЖИТЕЛЬ РАСТЕТ НЕЗАВИСИМО ОТ ДЕЙСТВИЙ ПОЛЬЗОВАТЕЛЕЙ
          return newMultiplier;
        }
      });
    }, 50); // Обновляем каждые 50ms для более плавной анимации
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
      {/* ОБНОВЛЕНО: График с CSS классом для эффектов */}
      <CrashGraph 
        multiplier={currentMultiplier}
        gameState={gameState}
        crashPoint={crashPoint}
        timeToStart={timeToStart}
        roundId={roundIdRef.current}
        className={getGraphCSSClass()}
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
