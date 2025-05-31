// frontend/src/components/games/crash/CrashGame.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CrashGraph from './CrashGraph';
import CrashControls from './CrashControls';
import CrashBetsList from './CrashBetsList';
import CrashHistory from './CrashHistory';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import { gameApi } from '../../../services';
import webSocketService from '../../../services/websocket.service';
import '../../../styles/CrashGame.css';

const CrashGame = ({ 
  balance = 0,
  setBalance, 
  gameStats, 
  setGameResult, 
  setError,
  userTelegramId 
}) => {
  const { 
    gameActionFeedback, 
    importantActionFeedback, 
    criticalActionFeedback,
    gameWinFeedback,
    gameLoseFeedback 
  } = useTactileFeedback();

  // Состояние загрузки
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Состояние игры
  const [gameState, setGameState] = useState('waiting');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [timeToStart, setTimeToStart] = useState(7);
  const [crashPoint, setCrashPoint] = useState(0);
  const [loading, setLoading] = useState(false);
  const [roundId, setRoundId] = useState(null);
  
  // Состояние ставки пользователя
  const [betAmount, setBetAmount] = useState(10);
  const [autoCashOut, setAutoCashOut] = useState(2.0);
  const [autoCashOutEnabled, setAutoCashOutEnabled] = useState(true);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [userBet, setUserBet] = useState(null);
  const [userGameId, setUserGameId] = useState(null);
  const [userCashOutMultiplier, setUserCashOutMultiplier] = useState(0);
  
  // УЛУЧШЕННОЕ: Состояние автовывода с дополнительными флагами
  const [autoWithdrawn, setAutoWithdrawn] = useState(false);
  const [isApproachingAutoCashOut, setIsApproachingAutoCashOut] = useState(false);
  const [localAutoCashOutTriggered, setLocalAutoCashOutTriggered] = useState(false); // НОВОЕ: Локальный флаг
  const [pendingAutoCashOut, setPendingAutoCashOut] = useState(false); // НОВОЕ: Ожидание подтверждения
  
  // Ставки и история
  const [activeBets, setActiveBets] = useState([]);
  const [cashedOutBets, setCashedOutBets] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Таймеры для обратного отсчета
  const countdownTimerRef = useRef(null);
  const lastMultiplierRef = useRef(1.00); // НОВОЕ: Отслеживание предыдущего множителя

  // ИСПРАВЛЕНИЕ: Функция для вычисления времени начала игры по множителю
  const calculateGameStartTime = useCallback((currentMultiplier) => {
    const elapsedSeconds = (currentMultiplier - 1) / 0.06;
    return Date.now() - (elapsedSeconds * 1000);
  }, []);

  // УЛУЧШЕННАЯ: Проверка автовывода с мгновенным срабатыванием
  const checkAndTriggerAutoCashOut = useCallback(() => {
    if (!hasBet || !userBet || !autoCashOutEnabled || userBet.autoCashOut <= 0 || cashedOut || localAutoCashOutTriggered) {
      return;
    }
    
    const targetMultiplier = userBet.autoCashOut;
    const approachThreshold = targetMultiplier * 0.95; // 95% от цели
    
    // Проверяем приближение к автовыводу
    if (currentMultiplier >= approachThreshold && currentMultiplier < targetMultiplier) {
      setIsApproachingAutoCashOut(true);
    } else if (currentMultiplier < approachThreshold) {
      setIsApproachingAutoCashOut(false);
    }
    
    // КЛЮЧЕВАЯ ЛОГИКА: Мгновенное срабатывание автовывода при достижении цели
    if (currentMultiplier >= targetMultiplier && lastMultiplierRef.current < targetMultiplier) {
      console.log('🎯 АВТОВЫВОД ДОСТИГНУТ! Множитель:', currentMultiplier, 'Цель:', targetMultiplier);
      
      // МГНОВЕННО обновляем UI
      setLocalAutoCashOutTriggered(true);
      setCashedOut(true);
      setUserCashOutMultiplier(targetMultiplier);
      setAutoWithdrawn(true);
      setIsApproachingAutoCashOut(false);
      setPendingAutoCashOut(true); // Ждем подтверждения от сервера
      
      // Рассчитываем выигрыш
      const winAmount = userBet.amount * targetMultiplier;
      const profit = winAmount - userBet.amount;
      
      // Показываем результат немедленно
      setGameResult({
        win: true,
        amount: profit,
        newBalance: balance + winAmount, // Предварительный баланс
        isAutoCashOut: true,
        multiplier: targetMultiplier
      });
      
      gameWinFeedback();
      
      console.log('🎉 UI обновлен мгновенно, ожидаем подтверждения от сервера');
    }
    
    // Обновляем последний множитель
    lastMultiplierRef.current = currentMultiplier;
  }, [hasBet, userBet, autoCashOutEnabled, currentMultiplier, cashedOut, localAutoCashOutTriggered, balance, setGameResult, gameWinFeedback]);

  // НОВОЕ: Отслеживание изменений множителя для автовывода
  useEffect(() => {
    if (gameState === 'flying') {
      checkAndTriggerAutoCashOut();
    }
  }, [currentMultiplier, gameState, checkAndTriggerAutoCashOut]);

  // Инициализация WebSocket и загрузка начальных данных
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('=== ИНИЦИАЛИЗАЦИЯ КРАШ ИГРЫ ===');
        
        await webSocketService.connect(userTelegramId);
        webSocketService.joinCrash();
        
        const stateResponse = await gameApi.getCrashState();
        if (stateResponse.success) {
          updateGameState(stateResponse.data);
        }
        
        const historyResponse = await gameApi.getCrashHistory();
        if (historyResponse.success) {
          setHistory(historyResponse.data);
        } else {
          setHistory([]);
        }
        
        setIsInitializing(false);
        
      } catch (err) {
        console.error('Ошибка инициализации:', err);
        setError('Ошибка загрузки игры');
        setIsInitializing(false);
      }
    };
    
    initializeGame();
    
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      webSocketService.leaveCrash();
    };
  }, [userTelegramId, setError]);

  // Подписка на WebSocket события
  useEffect(() => {
    if (isInitializing) return;

    // Новый раунд
    const unsubNewRound = webSocketService.on('crash_new_round', (data) => {
      console.log('🎮 Новый раунд:', data);
      setGameState('waiting');
      setRoundId(data.roundId);
      setTimeToStart(data.timeToStart || 7);
      setCurrentMultiplier(1.00);
      lastMultiplierRef.current = 1.00; // НОВОЕ: Сброс отслеживания
      setCrashPoint(0);
      
      // ПОЛНЫЙ сброс состояния ставки для нового раунда
      setHasBet(false);
      setCashedOut(false);
      setUserBet(null);
      setUserGameId(null);
      setUserCashOutMultiplier(0);
      setAutoWithdrawn(false);
      setIsApproachingAutoCashOut(false);
      setLocalAutoCashOutTriggered(false); // НОВОЕ: Сброс локального флага
      setPendingAutoCashOut(false); // НОВОЕ: Сброс ожидания
      
      setTimeout(() => {
        setGameResult(null);
      }, 3000);
      
      setActiveBets([]);
      setCashedOutBets([]);
      
      startCountdown(data.timeToStart || 7);
    });

    // Обновление обратного отсчета
    const unsubCountdown = webSocketService.on('crash_countdown_update', (data) => {
      setTimeToStart(data.timeToStart);
    });

    // Игра началась
    const unsubGameStarted = webSocketService.on('crash_game_started', (data) => {
      console.log('🚀 Игра началась:', data);
      setGameState('flying');
      setCurrentMultiplier(1.00);
      lastMultiplierRef.current = 1.00; // НОВОЕ: Сброс отслеживания
      
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    });

    // Обновление множителя
    const unsubMultiplierUpdate = webSocketService.on('crash_multiplier_update', (data) => {
      setCurrentMultiplier(data.multiplier);
      // lastMultiplierRef.current будет обновлен в checkAndTriggerAutoCashOut
    });

    // Игра разбилась
    const unsubGameCrashed = webSocketService.on('crash_game_crashed', (data) => {
      console.log('💥 Игра разбилась:', data);
      setGameState('crashed');
      setCrashPoint(data.crashPoint);
      setCurrentMultiplier(data.crashPoint);
      
      loadHistory();
      
      // УЛУЧШЕННАЯ логика проверки проигрыша
      const checkForLoss = () => {
        // Если уже есть результат или уже выведено - не перезаписываем
        setGameResult(prevResult => {
          if (prevResult && prevResult.win) {
            console.log('Есть результат выигрыша, не перезаписываем');
            return prevResult;
          }
          
          setCashedOut(currentCashedOut => {
            // Если уже выведено или сработал локальный автовывод - не показываем проигрыш
            if (currentCashedOut || localAutoCashOutTriggered) {
              console.log('Уже выведено, не показываем проигрыш');
              return currentCashedOut;
            }
            
            // Проверяем наличие ставки
            if (hasBet && userBet) {
              console.log('Пользователь проиграл - не успел вывести');
              gameLoseFeedback();
              setGameResult({
                win: false,
                amount: userBet.amount || 0,
                newBalance: balance
              });
            }
            
            return currentCashedOut;
          });
          
          return prevResult;
        });
      };
      
      setTimeout(checkForLoss, 100);
    });

    // Новая ставка
    const unsubBetPlaced = webSocketService.on('crash_bet_placed', (data) => {
      console.log('💰 Новая ставка получена:', data);
      
      const newBet = {
        id: `bet-${data.userId}-${data.amount}-${Date.now()}`,
        userId: data.userId,
        username: data.username || 'Игрок',
        amount: data.amount,
        autoCashOut: data.autoCashOut || 0,
        isCurrentUser: data.userId === userTelegramId
      };
      
      setActiveBets(prev => {
        const exists = prev.find(bet => bet.userId === data.userId);
        if (exists) {
          console.log('Ставка уже существует, пропускаем');
          return prev;
        }
        
        return [...prev, newBet];
      });
    });

    // УЛУЧШЕННЫЙ: Автоматический кешаут с подтверждением
    const unsubAutoCashOut = webSocketService.on('crash_auto_cash_out', (data) => {
      console.log('🤖 Подтверждение автокешаута от сервера:', data);
      
      if (data.userId === userTelegramId) {
        console.log('🎯 Подтверждение нашего автовывода');
        
        // Обновляем баланс точными данными от сервера
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
        // Убираем флаг ожидания
        setPendingAutoCashOut(false);
        
        // Обновляем результат точными данными
        setGameResult(prevResult => ({
          ...prevResult,
          amount: data.profit || prevResult.amount,
          newBalance: data.balanceAfter || prevResult.newBalance
        }));
        
        console.log('✅ Автовывод подтвержден сервером');
      }
      
      handleCashOutEvent(data, true);
    });

    // Ручной кешаут
    const unsubManualCashOut = webSocketService.on('crash_manual_cash_out', (data) => {
      console.log('💸 Ручной кешаут:', data);
      handleCashOutEvent(data, false);
    });

    // Текущее состояние игры
    const unsubGameState = webSocketService.on('crash_game_state', (data) => {
      console.log('📊 Состояние игры:', data);
      updateGameState(data);
    });

    // Раунд завершен
    const unsubRoundCompleted = webSocketService.on('crash_round_completed', (data) => {
      console.log('✅ Раунд завершен:', data);
    });

    // УЛУЧШЕННАЯ функция обработки кешаута
    const handleCashOutEvent = (data, isAutomatic = false) => {
      console.log('💸 Обработка кешаута:', data, 'Автоматический:', isAutomatic);
      
      if (!data.userId || !data.amount || !data.multiplier) {
        console.warn('Некорректные данные кешаута:', data);
        return;
      }
      
      // Убираем из активных ставок
      setActiveBets(prev => prev.filter(bet => bet.userId !== data.userId));
      
      // Добавляем в выведенные ставки
      const cashOutEntry = {
        id: `cashout-${data.userId}-${Date.now()}`,
        userId: data.userId,
        username: data.username || 'Игрок',
        amount: data.amount,
        cashOutMultiplier: data.multiplier,
        winAmount: data.amount * data.multiplier,
        isCurrentUser: data.userId === userTelegramId
      };
      
      setCashedOutBets(prev => {
        const exists = prev.find(bet => bet.userId === data.userId && 
          Math.abs(bet.cashOutMultiplier - data.multiplier) < 0.01);
        if (exists) {
          return prev;
        }
        return [...prev, cashOutEntry];
      });
      
      // Если это НЕ наш автовывод (который уже обработан локально)
      if (data.userId === userTelegramId && !localAutoCashOutTriggered) {
        console.log('🎯 Обычный кешаут (не автовывод)');
        
        setCashedOut(true);
        setUserCashOutMultiplier(data.multiplier);
        
        if (isAutomatic) {
          setAutoWithdrawn(true);
        }
        
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
        setGameResult({
          win: true,
          amount: data.profit || (data.amount * data.multiplier - data.amount),
          newBalance: data.balanceAfter,
          isAutoCashOut: isAutomatic,
          multiplier: data.multiplier
        });
        
        gameWinFeedback();
      }
    };

    return () => {
      unsubNewRound();
      unsubCountdown();
      unsubGameStarted();
      unsubMultiplierUpdate();
      unsubGameCrashed();
      unsubBetPlaced();
      unsubAutoCashOut();
      unsubManualCashOut();
      unsubGameState();
      unsubRoundCompleted();
    };
  }, [isInitializing, hasBet, cashedOut, userBet, balance, userTelegramId, autoCashOutEnabled, gameLoseFeedback, gameWinFeedback, setGameResult, startCountdown, loadHistory, updateGameState, gameState, localAutoCashOutTriggered]);

  // ИСПРАВЛЕННОЕ обновление состояния игры
  const updateGameState = useCallback((state) => {
    console.log('📊 Обновление состояния игры:', state);
    
    if (!state || typeof state !== 'object') {
      console.warn('Получено некорректное состояние игры:', state);
      return;
    }
    
    setGameState(state.status || 'waiting');
    setRoundId(state.roundId || null);
    
    if (state.status === 'flying' && state.currentMultiplier > 1.0) {
      console.log('КРАШ: Восстанавливаем активную игру с множителем:', state.currentMultiplier);
      
      const calculatedStartTime = calculateGameStartTime(state.currentMultiplier);
      console.log('КРАШ: Вычисленное время начала игры:', new Date(calculatedStartTime));
      
      setCurrentMultiplier(state.currentMultiplier);
      lastMultiplierRef.current = state.currentMultiplier; // НОВОЕ: Обновляем отслеживание
      
      window.crashGameStartTime = calculatedStartTime;
    } else if (state.currentMultiplier !== undefined && state.currentMultiplier > 0) {
      setCurrentMultiplier(state.currentMultiplier);
      lastMultiplierRef.current = state.currentMultiplier; // НОВОЕ: Обновляем отслеживание
    }
    
    if (state.status === 'waiting' && state.timeToStart > 0) {
      setTimeToStart(state.timeToStart);
      startCountdown(state.timeToStart);
    }
    
    if (state.bets && Array.isArray(state.bets)) {
      const active = [];
      const cashedOut = [];
      
      state.bets.forEach(bet => {
        if (!bet.userId || !bet.amount) {
          console.warn('Некорректная ставка:', bet);
          return;
        }
        
        const betData = {
          id: `bet-${bet.userId}-${bet.amount}-${Date.now()}`,
          userId: bet.userId,
          username: bet.username || 'Игрок',
          amount: bet.amount,
          autoCashOut: bet.autoCashOut || 0,
          isCurrentUser: bet.userId === userTelegramId
        };
        
        if (bet.cashedOut) {
          cashedOut.push({
            ...betData,
            cashOutMultiplier: bet.cashOutMultiplier || 0,
            winAmount: (bet.amount || 0) * (bet.cashOutMultiplier || 0)
          });
        } else {
          active.push(betData);
        }
        
        if (bet.userId === userTelegramId) {
          console.log('🎯 Найдена наша ставка в состоянии игры:', bet);
          setHasBet(true);
          
          if (bet.cashedOut) {
            console.log('🎯 Наша ставка уже выведена, обновляем состояние');
            setCashedOut(true);
            if (bet.cashOutMultiplier) {
              setUserCashOutMultiplier(bet.cashOutMultiplier);
            }
          } else {
            console.log('🎯 Наша ставка активна');
            setCashedOut(false);
            setUserCashOutMultiplier(0);
            setAutoWithdrawn(false);
            setLocalAutoCashOutTriggered(false); // НОВОЕ: Сброс локального флага
          }
          
          setUserBet({
            amount: bet.amount,
            autoCashOut: bet.autoCashOut || 0
          });
        }
      });
      
      console.log('Обновленные ставки из состояния игры:', { active, cashedOut });
      setActiveBets(active);
      setCashedOutBets(cashedOut);
    } else {
      if (state.status === 'waiting') {
        setActiveBets([]);
        setCashedOutBets([]);
      }
    }
  }, [userTelegramId, startCountdown, calculateGameStartTime]);

  // Обратный отсчет
  const startCountdown = useCallback((seconds) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    let remaining = seconds;
    setTimeToStart(remaining);
    
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeToStart(remaining);
      
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1000);
  }, []);

  // Загрузка истории
  const loadHistory = useCallback(async () => {
    try {
      console.log('КРАШ: Перезагружаем историю...');
      const response = await gameApi.getCrashHistory();
      if (response.success) {
        setHistory(response.data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      setHistory([]);
    }
  }, []);

  // Размещение ставки
  const placeBet = useCallback(async () => {
    if (gameState !== 'waiting' || hasBet || betAmount <= 0 || betAmount > balance || loading) {
      return;
    }
    
    try {
      setLoading(true);
      gameActionFeedback();
      
      const finalAutoCashOut = autoCashOutEnabled && autoCashOut && !isNaN(autoCashOut) ? autoCashOut : 0;
      const response = await gameApi.placeCrashBet(betAmount, finalAutoCashOut);
      
      if (response.success) {
        console.log('✅ Ставка размещена:', response.data);
        
        setBalance(response.data.balanceAfter);
        
        setHasBet(true);
        setCashedOut(false);
        setUserCashOutMultiplier(0);
        setAutoWithdrawn(false);
        setLocalAutoCashOutTriggered(false); // НОВОЕ: Сброс локального флага
        setPendingAutoCashOut(false); // НОВОЕ: Сброс ожидания
        setUserBet({
          amount: betAmount,
          autoCashOut: finalAutoCashOut
        });
        setUserGameId(response.data.gameId);
      }
      
    } catch (err) {
      console.error('❌ Ошибка размещения ставки:', err);
      setError(err.response?.data?.message || 'Ошибка размещения ставки');
    } finally {
      setLoading(false);
    }
  }, [gameState, hasBet, betAmount, balance, loading, autoCashOut, autoCashOutEnabled, userTelegramId, setBalance, setError, gameActionFeedback]);

  // Кешаут
  const cashOut = useCallback(async () => {
    if (gameState !== 'flying' || !hasBet || cashedOut || loading) {
      return;
    }
    
    try {
      setLoading(true);
      criticalActionFeedback();
      
      const response = await gameApi.cashOutCrash();
      
      if (response.success) {
        setBalance(response.data.balanceAfter);
        setCashedOut(true);
        setUserCashOutMultiplier(response.data.multiplier);
        
        setGameResult({
          win: true,
          amount: response.data.profit,
          newBalance: response.data.balanceAfter
        });
        
        gameWinFeedback();
        
        console.log('✅ Кешаут успешен:', response.data);
      }
      
    } catch (err) {
      console.error('❌ Ошибка кешаута:', err);
      setError(err.response?.data?.message || 'Ошибка вывода ставки');
    } finally {
      setLoading(false);
    }
  }, [gameState, hasBet, cashedOut, loading, setBalance, setError, setGameResult, criticalActionFeedback, gameWinFeedback]);

  // УЛУЧШЕННАЯ функция получения текста для главной кнопки
  const getMainButtonText = () => {
    if (loading) return 'Загрузка...';
    
    console.log('🔍 Определение текста кнопки:', {
      gameState,
      hasBet,
      cashedOut,
      localAutoCashOutTriggered,
      autoWithdrawn,
      userCashOutMultiplier,
      userBet,
      currentMultiplier,
      autoCashOutEnabled,
      isApproachingAutoCashOut,
      pendingAutoCashOut
    });
    
    switch (gameState) {
      case 'waiting':
        if (hasBet && userBet) return `Ставка размещена (${userBet.amount || 0} USDT)`;
        return `Поставить ${betAmount || 0} USDT`;
      case 'flying':
        if (!hasBet) return 'Ставка не размещена';
        
        // КЛЮЧЕВОЕ УЛУЧШЕНИЕ: Проверяем локальный автовывод ПЕРВЫМ делом
        if (localAutoCashOutTriggered || (cashedOut && userCashOutMultiplier > 0)) {
          const multiplier = userCashOutMultiplier || (userBet && userBet.autoCashOut) || currentMultiplier;
          
          if (pendingAutoCashOut) {
            return `Автовывод выполнен (${multiplier.toFixed(2)}x) ⏳`;
          } else if (autoWithdrawn || localAutoCashOutTriggered) {
            return `Автовыведено при ${multiplier.toFixed(2)}x`;
          } else {
            return `Выведено при ${multiplier.toFixed(2)}x`;
          }
        }
        
        // Если приближаемся к автовыводу
        if (isApproachingAutoCashOut && autoCashOutEnabled && userBet && userBet.autoCashOut > 0) {
          return `Автовывод приближается (${userBet.autoCashOut}x)`;
        }
        
        // Если есть ставка и НЕ выведено - показываем кнопку вывода
        if (userBet && !cashedOut && !localAutoCashOutTriggered) {
          return `Вывести (${((userBet.amount || 0) * (currentMultiplier || 1)).toFixed(2)} USDT)`;
        }
        
        return 'Вывести';
      case 'crashed':
        if (hasBet && !cashedOut && !localAutoCashOutTriggered) return 'Проигрыш';
        if (hasBet && (cashedOut || localAutoCashOutTriggered) && userCashOutMultiplier > 0) {
          if (autoWithdrawn || localAutoCashOutTriggered) {
            return `Автовыигрыш ${userCashOutMultiplier.toFixed(2)}x`;
          } else {
            return `Выигрыш ${userCashOutMultiplier.toFixed(2)}x`;
          }
        }
        return 'Раунд завершен';
      default:
        return 'Ошибка состояния';
    }
  };

  // УЛУЧШЕННАЯ функция получения класса для главной кнопки
  const getMainButtonClass = () => {
    if (loading) return 'loading';
    
    console.log('🔍 Определение класса кнопки:', {
      gameState,
      hasBet,
      cashedOut,
      localAutoCashOutTriggered,
      autoWithdrawn,
      userCashOutMultiplier,
      isApproachingAutoCashOut
    });
    
    switch (gameState) {
      case 'waiting':
        if (hasBet) return 'placed';
        return 'bet';
      case 'flying':
        if (!hasBet) return 'disabled';
        
        // КЛЮЧЕВОЕ УЛУЧШЕНИЕ: Если локальный автовывод сработал или выведено - показываем выигрыш
        if (localAutoCashOutTriggered || (cashedOut && userCashOutMultiplier > 0)) return 'won';
        
        // Если приближается автовывод - другой стиль
        if (isApproachingAutoCashOut) return 'approaching-auto';
        
        // Если есть ставка и НЕ выведено - кнопка кешаута
        return 'cashout';
      case 'crashed':
        if (hasBet && !cashedOut && !localAutoCashOutTriggered) return 'lost';
        if (hasBet && (cashedOut || localAutoCashOutTriggered)) return 'won';
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
        if (!hasBet) {
          placeBet();
        }
        break;
      case 'flying':
        // ИСПРАВЛЕНИЕ: Разрешаем кешаут только если есть ставка и НЕ выведено
        if (hasBet && !cashedOut && !localAutoCashOutTriggered) {
          cashOut();
        }
        break;
      default:
        break;
    }
  };

  // Загрузочный экран
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
          <div className="loading-text">Подключение к серверу...</div>
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
        roundId={roundId}
      />
      
      {/* Главная кнопка действия */}
      <button 
        className={`crash-main-action-btn ${getMainButtonClass()}`}
        onClick={handleMainButtonClick}
        disabled={loading || (gameState === 'waiting' && hasBet) || (gameState === 'flying' && (!hasBet || cashedOut || localAutoCashOutTriggered)) || gameState === 'crashed'}
      >
        {getMainButtonText()}
      </button>
      
      {/* Панель управления */}
      <CrashControls 
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        autoCashOut={autoCashOut}
        setAutoCashOut={setAutoCashOut}
        autoCashOutEnabled={autoCashOutEnabled}
        setAutoCashOutEnabled={setAutoCashOutEnabled}
        balance={balance}
        gameState={gameState}
        hasBet={hasBet}
        cashedOut={cashedOut || localAutoCashOutTriggered} // НОВОЕ: Учитываем локальный флаг
        userBet={userBet}
        userCashOutMultiplier={userCashOutMultiplier}
        loading={loading}
        currentMultiplier={currentMultiplier}
        autoWithdrawn={autoWithdrawn || localAutoCashOutTriggered} // НОВОЕ: Учитываем локальный флаг
        isApproachingAutoCashOut={isApproachingAutoCashOut}
      />
      
      {/* Информационные панели */}
      <div className="crash-info-panels">
        <CrashBetsList 
          activeBets={activeBets}
          cashedOutBets={cashedOutBets}
          gameState={gameState}
          currentMultiplier={currentMultiplier}
        />
        
        <CrashHistory 
          history={history}
        />
      </div>
    </div>
  );
};

export default CrashGame;
