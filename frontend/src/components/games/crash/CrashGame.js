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
  
  // НОВОЕ: Состояние автовывода
  const [autoWithdrawn, setAutoWithdrawn] = useState(false);
  const [isApproachingAutoCashOut, setIsApproachingAutoCashOut] = useState(false);
  
  // Ставки и история
  const [activeBets, setActiveBets] = useState([]);
  const [cashedOutBets, setCashedOutBets] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Таймеры для обратного отсчета
  const countdownTimerRef = useRef(null);

  // ИСПРАВЛЕНИЕ: Функция для вычисления времени начала игры по множителю
  const calculateGameStartTime = useCallback((currentMultiplier) => {
    // Используем обратную формулу роста множителя
    // Множитель растет как 1 + время * 0.06
    // Отсюда: время = (множитель - 1) / 0.06
    const elapsedSeconds = (currentMultiplier - 1) / 0.06;
    return Date.now() - (elapsedSeconds * 1000);
  }, []);

  // НОВОЕ: Проверка приближения к автовыводу
  const checkAutoCashOutApproach = useCallback(() => {
    if (hasBet && userBet && autoCashOutEnabled && userBet.autoCashOut > 0 && !cashedOut) {
      const approachThreshold = userBet.autoCashOut * 0.95; // 95% от цели
      if (currentMultiplier >= approachThreshold && currentMultiplier < userBet.autoCashOut) {
        setIsApproachingAutoCashOut(true);
      } else {
        setIsApproachingAutoCashOut(false);
      }
    } else {
      setIsApproachingAutoCashOut(false);
    }
  }, [hasBet, userBet, autoCashOutEnabled, currentMultiplier, cashedOut]);

  // Отслеживание приближения к автовыводу
  useEffect(() => {
    checkAutoCashOutApproach();
  }, [checkAutoCashOutApproach]);

  // Инициализация WebSocket и загрузка начальных данных
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log('=== ИНИЦИАЛИЗАЦИЯ КРАШ ИГРЫ ===');
        
        // Подключаемся к WebSocket
        await webSocketService.connect(userTelegramId);
        
        // Присоединяемся к краш игре
        webSocketService.joinCrash();
        
        // Загружаем начальное состояние
        const stateResponse = await gameApi.getCrashState();
        if (stateResponse.success) {
          updateGameState(stateResponse.data);
        }
        
        // Загружаем историю
        console.log('КРАШ: Загружаем историю...');
        const historyResponse = await gameApi.getCrashHistory();
        console.log('КРАШ: Ответ истории:', historyResponse);
        if (historyResponse.success) {
          console.log('КРАШ: Данные истории:', historyResponse.data);
          setHistory(historyResponse.data);
        } else {
          console.log('КРАШ: История не загружена - ответ не успешный');
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
      // Очистка при размонтировании
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
      setCrashPoint(0);
      
      // ИСПРАВЛЕНИЕ: Полный сброс состояния ставки для нового раунда
      setHasBet(false);
      setCashedOut(false);
      setUserBet(null);
      setUserGameId(null);
      setUserCashOutMultiplier(0);
      setAutoWithdrawn(false); // НОВОЕ: Сбрасываем автовывод
      setIsApproachingAutoCashOut(false); // НОВОЕ: Сбрасываем приближение
      
      // Сбрасываем результат с задержкой, чтобы пользователь успел увидеть окно
      setTimeout(() => {
        setGameResult(null);
      }, 3000);
      
      // Очищаем списки ставок
      setActiveBets([]);
      setCashedOutBets([]);
      
      // Запускаем обратный отсчет
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
      
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    });

    // Обновление множителя
    const unsubMultiplierUpdate = webSocketService.on('crash_multiplier_update', (data) => {
      setCurrentMultiplier(data.multiplier);
    });

    // Игра разбилась
    const unsubGameCrashed = webSocketService.on('crash_game_crashed', (data) => {
      console.log('💥 Игра разбилась:', data);
      setGameState('crashed');
      setCrashPoint(data.crashPoint);
      setCurrentMultiplier(data.crashPoint);
      
      // Обновляем историю
      loadHistory();
      
      // НОВАЯ ЛОГИКА: Проверяем автовывод с учетом тумблера
      const checkForLoss = () => {
        setCashedOut(currentCashedOut => {
          setGameResult(prevResult => {
            // Если уже есть результат выигрыша, не перезаписываем
            if (prevResult && prevResult.win) {
              console.log('Есть активный выигрыш, не перезаписываем проигрышем');
              return prevResult;
            }
            
            // Если пользователь успел вывести средства, не показываем проигрыш
            if (currentCashedOut) {
              console.log('Пользователь успел вывести, не показываем проигрыш');
              return prevResult;
            }
            
            // Проверяем наличие ставки и автовывод
            if (hasBet && userBet) {
              // Если автовывод был включен и сработал бы
              if (autoCashOutEnabled && userBet.autoCashOut > 0 && data.crashPoint >= userBet.autoCashOut) {
                console.log('Автовывод должен был сработать, но не сработал - возможно краш произошел одновременно');
                // В этом случае не показываем ни выигрыш, ни проигрыш - ждем от сервера
                return prevResult;
              }
              
              // Если автовывод выключен или не должен был сработать - проигрыш
              console.log('Пользователь проиграл - не успел вывести или автовывод выключен');
              gameLoseFeedback();
              return {
                win: false,
                amount: userBet.amount || 0,
                newBalance: balance
              };
            }
            
            return prevResult;
          });
          
          return currentCashedOut;
        });
      };
      
      // Небольшая задержка чтобы дать автовыводу время сработать
      setTimeout(checkForLoss, 50);
    });

    // Новая ставка
    const unsubBetPlaced = webSocketService.on('crash_bet_placed', (data) => {
      console.log('💰 Новая ставка получена:', data);
      
      // Добавляем ставку в список активных ставок
      const newBet = {
        id: `bet-${data.userId}-${data.amount}-${Date.now()}`,
        userId: data.userId,
        username: data.username || 'Игрок',
        amount: data.amount,
        autoCashOut: data.autoCashOut || 0,
        isCurrentUser: data.userId === userTelegramId
      };
      
      setActiveBets(prev => {
        // Проверяем, что ставка еще не добавлена
        const exists = prev.find(bet => bet.userId === data.userId);
        if (exists) {
          console.log('Ставка уже существует, пропускаем');
          return prev;
        }
        
        console.log('Добавляем новую ставку:', newBet);
        return [...prev, newBet];
      });
    });

    // Автоматический кешаут
    const unsubAutoCashOut = webSocketService.on('crash_auto_cash_out', (data) => {
      console.log('🤖 Автокешаут:', data);
      handleCashOutEvent(data, true); // Передаем флаг, что это автовывод
    });

    // Ручной кешаут
    const unsubManualCashOut = webSocketService.on('crash_manual_cash_out', (data) => {
      console.log('💸 Ручной кешаут:', data);
      handleCashOutEvent(data, false); // Передаем флаг, что это ручной вывод
    });

    // Текущее состояние игры
    const unsubGameState = webSocketService.on('crash_game_state', (data) => {
      console.log('📊 Состояние игры:', data);
      updateGameState(data);
    });

    // Раунд завершен
    const unsubRoundCompleted = webSocketService.on('crash_round_completed', (data) => {
      console.log('✅ Раунд завершен:', data);
      // Можно добавить дополнительную логику при завершении раунда
    });

    // ИСПРАВЛЕННАЯ функция обработки кешаута
    const handleCashOutEvent = (data, isAutomatic = false) => {
      console.log('💸 Обработка кешаута:', data, 'Автоматический:', isAutomatic);
      
      if (!data.userId || !data.amount || !data.multiplier) {
        console.warn('Некорректные данные кешаута:', data);
        return;
      }
      
      // Убираем из активных ставок
      setActiveBets(prev => {
        const updated = prev.filter(bet => bet.userId !== data.userId);
        console.log('Активные ставки после удаления:', updated);
        return updated;
      });
      
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
        // Проверяем, что этот кешаут еще не добавлен
        const exists = prev.find(bet => bet.userId === data.userId && 
          Math.abs(bet.cashOutMultiplier - data.multiplier) < 0.01);
        if (exists) {
          console.log('Кешаут уже существует, пропускаем');
          return prev;
        }
        
        const updated = [...prev, cashOutEntry];
        console.log('Выведенные ставки после добавления:', updated);
        return updated;
      });
      
      // ИСПРАВЛЕНИЕ: Если это наш кешаут, обновляем состояние СИНХРОННО
      if (data.userId === userTelegramId) {
        console.log('🎯 Это наш кешаут! Обновляем состояние НЕМЕДЛЕННО');
        
        // КРИТИЧЕСКИ ВАЖНО: Используем функциональные обновления для атомарности
        setCashedOut(prevCashedOut => {
          console.log('📊 Обновляем cashedOut:', prevCashedOut, '->', true);
          return true;
        });
        
        setUserCashOutMultiplier(prevMultiplier => {
          console.log('📊 Обновляем userCashOutMultiplier:', prevMultiplier, '->', data.multiplier);
          return data.multiplier;
        });
        
        // НОВОЕ: Отмечаем автовывод если это был автоматический кешаут
        if (isAutomatic) {
          setAutoWithdrawn(true);
          console.log('🤖 Отмечен автовывод');
        }
        
        // Обновляем баланс если передан
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
          console.log('💰 Баланс обновлен на:', data.balanceAfter);
        } else if (data.profit !== undefined) {
          // Если нет balanceAfter, пытаемся вычислить его
          setBalance(prev => {
            const newBalance = prev + data.profit;
            console.log('💰 Баланс вычислен:', prev, '+', data.profit, '=', newBalance);
            return newBalance;
          });
        }
        
        // Немедленно показываем результат
        console.log('🎉 Устанавливаем результат кешаута для отображения');
        setGameResult({
          win: true,
          amount: data.profit || (data.amount * data.multiplier - data.amount), // Прибыль
          newBalance: data.balanceAfter,
          isAutoCashOut: isAutomatic,
          multiplier: data.multiplier
        });
        
        gameWinFeedback();
        
        // ДОПОЛНИТЕЛЬНАЯ ОТЛАДКА
        console.log('🔍 Финальное состояние после кешаута:');
        console.log('  - cashedOut будет:', true);
        console.log('  - userCashOutMultiplier будет:', data.multiplier);
        console.log('  - autoWithdrawn будет:', isAutomatic);
        console.log('  - hasBet:', hasBet);
        console.log('  - gameState:', gameState);
      }
    };

    // Очистка подписок
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
  }, [isInitializing, hasBet, cashedOut, userBet, balance, userTelegramId, autoCashOutEnabled, gameLoseFeedback, gameWinFeedback, setGameResult, startCountdown, loadHistory, updateGameState, gameState]);

  // ИСПРАВЛЕННОЕ обновление состояния игры
  const updateGameState = useCallback((state) => {
    console.log('📊 Обновление состояния игры:', state);
    
    if (!state || typeof state !== 'object') {
      console.warn('Получено некорректное состояние игры:', state);
      return;
    }
    
    setGameState(state.status || 'waiting');
    setRoundId(state.roundId || null);
    
    // ИСПРАВЛЕНИЕ: Правильная обработка активной игры
    if (state.status === 'flying' && state.currentMultiplier > 1.0) {
      console.log('КРАШ: Восстанавливаем активную игру с множителем:', state.currentMultiplier);
      
      // Вычисляем правильное время начала игры
      const calculatedStartTime = calculateGameStartTime(state.currentMultiplier);
      console.log('КРАШ: Вычисленное время начала игры:', new Date(calculatedStartTime));
      
      // Устанавливаем множитель и информируем график о необходимости восстановления траектории
      setCurrentMultiplier(state.currentMultiplier);
      
      // Передаем вычисленное время в глобальное состояние для использования в графике
      // Это будет обработано в CrashGraph.js
      window.crashGameStartTime = calculatedStartTime;
    } else if (state.currentMultiplier !== undefined && state.currentMultiplier > 0) {
      // Обычное обновление множителя
      setCurrentMultiplier(state.currentMultiplier);
    }
    
    if (state.status === 'waiting' && state.timeToStart > 0) {
      setTimeToStart(state.timeToStart);
      startCountdown(state.timeToStart);
    }
    
    // Обновляем список ставок только если есть данные
    if (state.bets && Array.isArray(state.bets)) {
      const active = [];
      const cashedOut = [];
      
      state.bets.forEach(bet => {
        // Валидация данных ставки
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
        
        // ИСПРАВЛЕНИЕ: Проверяем нашу ставку с правильной обработкой кешаута
        if (bet.userId === userTelegramId) {
          console.log('🎯 Найдена наша ставка в состоянии игры:', bet);
          setHasBet(true);
          
          // КРИТИЧЕСКИ ВАЖНО: Правильно обновляем состояние кешаута
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
            setAutoWithdrawn(false); // Сбрасываем автовывод для активной ставки
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
      console.log('Нет ставок в состоянии игры, очищаем списки');
      // Если нет ставок в состоянии, очищаем только если это новый раунд
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
      console.log('КРАШ: Ответ перезагрузки истории:', response);
      if (response.success) {
        console.log('КРАШ: Новые данные истории:', response.data);
        setHistory(response.data);
      } else {
        console.log('КРАШ: Перезагрузка истории не успешна');
        setHistory([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      setHistory([]);
    }
  }, []);

  // Размещение ставки - ИСПРАВЛЕННОЕ
  const placeBet = useCallback(async () => {
    if (gameState !== 'waiting' || hasBet || betAmount <= 0 || betAmount > balance || loading) {
      return;
    }
    
    try {
      setLoading(true);
      gameActionFeedback();
      
      // Определяем автовывод на основе тумблера
      const finalAutoCashOut = autoCashOutEnabled && autoCashOut && !isNaN(autoCashOut) ? autoCashOut : 0;
      const response = await gameApi.placeCrashBet(betAmount, finalAutoCashOut);
      
      if (response.success) {
        console.log('✅ Ставка размещена:', response.data);
        
        // Обновляем баланс немедленно
        setBalance(response.data.balanceAfter);
        
        // ИСПРАВЛЕНИЕ: Обновляем состояние ставки с правильными значениями
        setHasBet(true);
        setCashedOut(false); // Явно сбрасываем кешаут
        setUserCashOutMultiplier(0); // Явно сбрасываем множитель
        setAutoWithdrawn(false); // Сбрасываем автовывод
        setUserBet({
          amount: betAmount,
          autoCashOut: finalAutoCashOut
        });
        setUserGameId(response.data.gameId);
        
        // НЕ добавляем ставку локально - она придет через WebSocket событие
        // Это предотвратит дублирование ставок
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

  // ИСПРАВЛЕННАЯ функция получения текста для главной кнопки
  const getMainButtonText = () => {
    if (loading) return 'Загрузка...';
    
    // Добавляем отладочную информацию
    console.log('🔍 Определение текста кнопки:', {
      gameState,
      hasBet,
      cashedOut,
      autoWithdrawn,
      userCashOutMultiplier,
      userBet,
      currentMultiplier,
      autoCashOutEnabled,
      isApproachingAutoCashOut
    });
    
    switch (gameState) {
      case 'waiting':
        if (hasBet && userBet) return `Ставка размещена (${userBet.amount || 0} USDT)`;
        return `Поставить ${betAmount || 0} USDT`;
      case 'flying':
        if (!hasBet) return 'Ставка не размещена';
        
        // ИСПРАВЛЕНИЕ: Проверяем кешаут ПЕРВЫМ делом
        if (cashedOut && userCashOutMultiplier > 0) {
          // НОВОЕ: Показываем тип вывода
          if (autoWithdrawn) {
            return `Автовыведено при ${userCashOutMultiplier.toFixed(2)}x`;
          } else {
            return `Выведено при ${userCashOutMultiplier.toFixed(2)}x`;
          }
        }
        
        // НОВОЕ: Если приближаемся к автовыводу
        if (isApproachingAutoCashOut && autoCashOutEnabled && userBet && userBet.autoCashOut > 0) {
          return `Автовывод приближается (${userBet.autoCashOut}x)`;
        }
        
        // Если есть ставка и НЕ выведено - показываем кнопку вывода
        if (userBet && !cashedOut) {
          return `Вывести (${((userBet.amount || 0) * (currentMultiplier || 1)).toFixed(2)} USDT)`;
        }
        
        return 'Вывести';
      case 'crashed':
        if (hasBet && !cashedOut) return 'Проигрыш';
        if (hasBet && cashedOut && userCashOutMultiplier > 0) {
          // НОВОЕ: Показываем тип выигрыша
          if (autoWithdrawn) {
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

  // ИСПРАВЛЕННАЯ функция получения класса для главной кнопки
  const getMainButtonClass = () => {
    if (loading) return 'loading';
    
    // Добавляем отладочную информацию
    console.log('🔍 Определение класса кнопки:', {
      gameState,
      hasBet,
      cashedOut,
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
        
        // ИСПРАВЛЕНИЕ: Если выведено - показываем состояние выигрыша
        if (cashedOut && userCashOutMultiplier > 0) return 'won';
        
        // НОВОЕ: Если приближается автовывод - другой стиль
        if (isApproachingAutoCashOut) return 'approaching-auto';
        
        // Если есть ставка и НЕ выведено - кнопка кешаута
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
        if (!hasBet) {
          placeBet();
        }
        break;
      case 'flying':
        // ИСПРАВЛЕНИЕ: Разрешаем кешаут только если есть ставка и НЕ выведено
        if (hasBet && !cashedOut) {
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
        autoCashOutEnabled={autoCashOutEnabled}
        setAutoCashOutEnabled={setAutoCashOutEnabled}
        balance={balance}
        gameState={gameState}
        hasBet={hasBet}
        cashedOut={cashedOut}
        userBet={userBet}
        userCashOutMultiplier={userCashOutMultiplier}
        loading={loading}
        currentMultiplier={currentMultiplier}
        autoWithdrawn={autoWithdrawn}
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
