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
  const [localAutoCashOutTriggered, setLocalAutoCashOutTriggered] = useState(false);
  const [pendingAutoCashOut, setPendingAutoCashOut] = useState(false);
  
  // Ставки и история
  const [activeBets, setActiveBets] = useState([]);
  const [cashedOutBets, setCashedOutBets] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Таймеры для обратного отсчета
  const countdownTimerRef = useRef(null);
  const lastMultiplierRef = useRef(1.00);

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
    const approachThreshold = targetMultiplier * 0.95;
    
    if (currentMultiplier >= approachThreshold && currentMultiplier < targetMultiplier) {
      setIsApproachingAutoCashOut(true);
    } else if (currentMultiplier < approachThreshold) {
      setIsApproachingAutoCashOut(false);
    }
    
    if (currentMultiplier >= targetMultiplier && lastMultiplierRef.current < targetMultiplier) {
      console.log('🎯 АВТОВЫВОД ДОСТИГНУТ! Множитель:', currentMultiplier, 'Цель:', targetMultiplier);
      
      setLocalAutoCashOutTriggered(true);
      setCashedOut(true);
      setUserCashOutMultiplier(targetMultiplier);
      setAutoWithdrawn(true);
      setIsApproachingAutoCashOut(false);
      setPendingAutoCashOut(true);
      
      const winAmount = userBet.amount * targetMultiplier;
      const profit = winAmount - userBet.amount;
      
      setGameResult({
        win: true,
        amount: profit,
        newBalance: balance + winAmount,
        isAutoCashOut: true,
        multiplier: targetMultiplier
      });
      
      gameWinFeedback();
      
      console.log('🎉 UI обновлен мгновенно, ожидаем подтверждения от сервера');
    }
    
    lastMultiplierRef.current = currentMultiplier;
  }, [hasBet, userBet, autoCashOutEnabled, currentMultiplier, cashedOut, localAutoCashOutTriggered, balance, setGameResult, gameWinFeedback]);

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
      lastMultiplierRef.current = state.currentMultiplier;
      
      window.crashGameStartTime = calculatedStartTime;
    } else if (state.currentMultiplier !== undefined && state.currentMultiplier > 0) {
      setCurrentMultiplier(state.currentMultiplier);
      lastMultiplierRef.current = state.currentMultiplier;
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
            setLocalAutoCashOutTriggered(false);
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
      lastMultiplierRef.current = 1.00;
      setCrashPoint(0);
      
      setHasBet(false);
      setCashedOut(false);
      setUserBet(null);
      setUserGameId(null);
      setUserCashOutMultiplier(0);
      setAutoWithdrawn(false);
      setIsApproachingAutoCashOut(false);
      setLocalAutoCashOutTriggered(false);
      setPendingAutoCashOut(false);
      
      setTimeout(() => {
        setGameResult(null);
      }, 3000);
      
      setActiveBets([]);
      setCashedOutBets([]);
      
      startCountdown(data.timeToStart || 7);
    });

    const unsubCountdown = webSocketService.on('crash_countdown_update', (data) => {
      setTimeToStart(data.timeToStart);
    });

    const unsubGameStarted = webSocketService.on('crash_game_started', (data) => {
      console.log('🚀 Игра началась:', data);
      setGameState('flying');
      setCurrentMultiplier(1.00);
      lastMultiplierRef.current = 1.00;
      
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    });

    const unsubMultiplierUpdate = webSocketService.on('crash_multiplier_update', (data) => {
      setCurrentMultiplier(data.multiplier);
    });

    const unsubGameCrashed = webSocketService.on('crash_game_crashed', (data) => {
      console.log('💥 Игра разбилась:', data);
      setGameState('crashed');
      setCrashPoint(data.crashPoint);
      setCurrentMultiplier(data.crashPoint);
      
      loadHistory();
      
      const checkForLoss = () => {
        setGameResult(prevResult => {
          if (prevResult && prevResult.win) {
            console.log('Есть результат выигрыша, не перезаписываем');
            return prevResult;
          }
          
          setCashedOut(currentCashedOut => {
            if (currentCashedOut || localAutoCashOutTriggered) {
              console.log('Уже выведено, не показываем проигрыш');
              return currentCashedOut;
            }
            
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

    const unsubAutoCashOut = webSocketService.on('crash_auto_cash_out', (data) => {
      console.log('🤖 Подтверждение автокешаута от сервера:', data);
      
      if (data.userId === userTelegramId) {
        console.log('🎯 Подтверждение нашего автовывода');
        
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
        setPendingAutoCashOut(false);
        
        setGameResult(prevResult => ({
          ...prevResult,
          amount: data.profit || prevResult.amount,
          newBalance: data.balanceAfter || prevResult.newBalance
        }));
        
        console.log('✅ Автовывод подтвержден сервером');
      }
      
      handleCashOutEvent(data, true);
    });

    const unsubManualCashOut = webSocketService.on('crash_manual_cash_out', (data) => {
      console.log('💸 Ручной кешаут:', data);
      handleCashOutEvent(data, false);
    });

    const unsubGameState = webSocketService.on('crash_game_state', (data) => {
      console.log('📊 Состояние игры:', data);
      updateGameState(data);
    });

    const unsubRoundCompleted = webSocketService.on('crash_round_completed', (data) => {
      console.log('✅ Раунд завершен:', data);
    });

    const handleCashOutEvent = (data, isAutomatic = false) => {
      console.log('💸 Обработка кешаута:', data, 'Автоматический:', isAutomatic);
      
      if (!data.userId || !data.amount || !data.multiplier) {
        console.warn('Некорректные данные кешаута:', data);
        return;
      }
      
      setActiveBets(prev => prev.filter(bet => bet.userId !== data.userId));
      
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

  // ИСПРАВЛЕННОЕ размещение ставки
  const placeBet = useCallback(async () => {
    console.log('🎮 КРАШ: Попытка размещения ставки');
    console.log('🎮 КРАШ: Состояние - gameState:', gameState, 'hasBet:', hasBet, 'betAmount:', betAmount, 'balance:', balance, 'loading:', loading);
    
    // Проверяем все условия для размещения ставки
    if (gameState !== 'waiting') {
      console.log('🎮 КРАШ: Блокировано - игра не в состоянии ожидания. Текущее состояние:', gameState);
      return;
    }
    
    if (hasBet) {
      console.log('🎮 КРАШ: Блокировано - ставка уже размещена');
      return;
    }
    
    if (loading) {
      console.log('🎮 КРАШ: Блокировано - идет загрузка');
      return;
    }
    
    if (!betAmount || betAmount <= 0) {
      console.log('🎮 КРАШ: Блокировано - неверная сумма ставки:', betAmount);
      setError('Укажите корректную сумму ставки');
      return;
    }
    
    if (betAmount > balance) {
      console.log('🎮 КРАШ: Блокировано - недостаточно средств. Ставка:', betAmount, 'Баланс:', balance);
      setError('Недостаточно средств на балансе');
      return;
    }
    
    try {
      console.log('🎮 КРАШ: Все проверки пройдены, размещаем ставку');
      
      setLoading(true);
      gameActionFeedback();
      
      const finalAutoCashOut = autoCashOutEnabled && autoCashOut && !isNaN(autoCashOut) ? autoCashOut : 0;
      
      console.log('🎮 КРАШ: Отправляем запрос с параметрами:', {
        betAmount,
        finalAutoCashOut
      });
      
      const response = await gameApi.placeCrashBet(betAmount, finalAutoCashOut);
      
      if (response.success) {
        console.log('✅ КРАШ: Ставка размещена успешно:', response.data);
        
        setBalance(response.data.balanceAfter);
        
        setHasBet(true);
        setCashedOut(false);
        setUserCashOutMultiplier(0);
        setAutoWithdrawn(false);
        setLocalAutoCashOutTriggered(false);
        setPendingAutoCashOut(false);
        setUserBet({
          amount: betAmount,
          autoCashOut: finalAutoCashOut
        });
        setUserGameId(response.data.gameId);
        
        setError(null); // Очищаем предыдущие ошибки
        
        console.log('🎮 КРАШ: Состояние обновлено после размещения ставки');
      } else {
        throw new Error(response.message || 'Ошибка размещения ставки');
      }
      
    } catch (err) {
      console.error('❌ КРАШ: Ошибка размещения ставки:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка размещения ставки';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [gameState, hasBet, betAmount, balance, loading, autoCashOut, autoCashOutEnabled, setBalance, setError, gameActionFeedback]);

  // ИСПРАВЛЕННЫЙ кешаут
  const cashOut = useCallback(async () => {
    console.log('🎮 КРАШ: Попытка кешаута');
    console.log('🎮 КРАШ: Состояние - gameState:', gameState, 'hasBet:', hasBet, 'cashedOut:', cashedOut, 'loading:', loading);
    
    if (gameState !== 'flying') {
      console.log('🎮 КРАШ: Блокировано - игра не в полете. Текущее состояние:', gameState);
      return;
    }
    
    if (!hasBet) {
      console.log('🎮 КРАШ: Блокировано - нет активной ставки');
      return;
    }
    
    if (cashedOut) {
      console.log('🎮 КРАШ: Блокировано - ставка уже выведена');
      return;
    }
    
    if (loading) {
      console.log('🎮 КРАШ: Блокировано - идет загрузка');
      return;
    }
    
    try {
      console.log('🎮 КРАШ: Все проверки пройдены, выводим ставку');
      
      setLoading(true);
      criticalActionFeedback();
      
      const response = await gameApi.cashOutCrash();
      
      if (response.success) {
        console.log('✅ КРАШ: Кешаут успешен:', response.data);
        
        setBalance(response.data.balanceAfter);
        setCashedOut(true);
        setUserCashOutMultiplier(response.data.multiplier);
        
        setGameResult({
          win: true,
          amount: response.data.profit,
          newBalance: response.data.balanceAfter
        });
        
        gameWinFeedback();
        setError(null); // Очищаем предыдущие ошибки
        
      } else {
        throw new Error(response.message || 'Ошибка вывода ставки');
      }
      
    } catch (err) {
      console.error('❌ КРАШ: Ошибка кешаута:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка вывода ставки';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [gameState, hasBet, cashedOut, loading, setBalance, setError, setGameResult, criticalActionFeedback, gameWinFeedback]);

  // УЛУЧШЕННАЯ функция получения текста для главной кнопки
  const getMainButtonText = () => {
    if (loading) return 'Загрузка...';
    
    console.log('🔍 КРАШ: Определение текста кнопки:', {
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
      pendingAutoCashOut,
      betAmount,
      balance
    });
    
    switch (gameState) {
      case 'waiting':
        if (hasBet && userBet) return `Ставка размещена (${userBet.amount || 0} USDT)`;
        if (!betAmount || betAmount <= 0) return 'Укажите сумму ставки';
        if (betAmount > balance) return 'Недостаточно средств';
        return `Поставить ${betAmount || 0} USDT`;
      case 'flying':
        if (!hasBet) return 'Ставка не размещена';
        
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
        
        if (isApproachingAutoCashOut && autoCashOutEnabled && userBet && userBet.autoCashOut > 0) {
          return `Автовывод приближается (${userBet.autoCashOut}x)`;
        }
        
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
    
    console.log('🔍 КРАШ: Определение класса кнопки:', {
      gameState,
      hasBet,
      cashedOut,
      localAutoCashOutTriggered,
      autoWithdrawn,
      userCashOutMultiplier,
      isApproachingAutoCashOut,
      betAmount,
      balance
    });
    
    switch (gameState) {
      case 'waiting':
        if (hasBet) return 'placed';
        if (!betAmount || betAmount <= 0 || betAmount > balance) return 'disabled';
        return 'bet';
      case 'flying':
        if (!hasBet) return 'disabled';
        
        if (localAutoCashOutTriggered || (cashedOut && userCashOutMultiplier > 0)) return 'won';
        
        if (isApproachingAutoCashOut) return 'approaching-auto';
        
        return 'cashout';
      case 'crashed':
        if (hasBet && !cashedOut && !localAutoCashOutTriggered) return 'lost';
        if (hasBet && (cashedOut || localAutoCashOutTriggered)) return 'won';
        return 'disabled';
      default:
        return 'disabled';
    }
  };

  // ИСПРАВЛЕННЫЙ обработчик главной кнопки
  const handleMainButtonClick = () => {
    console.log('🎮 КРАШ: Нажата главная кнопка действия');
    console.log('🎮 КРАШ: Текущее состояние:', {
      gameState,
      hasBet,
      cashedOut,
      localAutoCashOutTriggered,
      loading,
      betAmount,
      balance
    });
    
    if (loading) {
      console.log('🎮 КРАШ: Блокировано - идет загрузка');
      return;
    }
    
    switch (gameState) {
      case 'waiting':
        if (!hasBet) {
          console.log('🎮 КРАШ: Размещаем ставку');
          placeBet();
        } else {
          console.log('🎮 КРАШ: Ставка уже размещена');
        }
        break;
      case 'flying':
        if (hasBet && !cashedOut && !localAutoCashOutTriggered) {
          console.log('🎮 КРАШ: Выводим ставку');
          cashOut();
        } else {
          console.log('🎮 КРАШ: Нельзя вывести - нет ставки или уже выведено');
        }
        break;
      default:
        console.log('🎮 КРАШ: Неподходящее состояние для действий:', gameState);
        break;
    }
  };

  // Функция определения блокировки кнопки
  const isMainButtonDisabled = () => {
    if (loading) return true;
    
    switch (gameState) {
      case 'waiting':
        return hasBet || !betAmount || betAmount <= 0 || betAmount > balance;
      case 'flying':
        return !hasBet || cashedOut || localAutoCashOutTriggered;
      case 'crashed':
        return true;
      default:
        return true;
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
      
      {/* ИСПРАВЛЕННАЯ главная кнопка действия */}
      <button 
        className={`crash-main-action-btn ${getMainButtonClass()}`}
        onClick={handleMainButtonClick}
        disabled={isMainButtonDisabled()}
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
        cashedOut={cashedOut || localAutoCashOutTriggered}
        userBet={userBet}
        userCashOutMultiplier={userCashOutMultiplier}
        loading={loading}
        currentMultiplier={currentMultiplier}
        autoWithdrawn={autoWithdrawn || localAutoCashOutTriggered}
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
