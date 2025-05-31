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
  balance = 0,  // Добавляем значение по умолчанию
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
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [userBet, setUserBet] = useState(null);
  const [userGameId, setUserGameId] = useState(null);
  const [userCashOutMultiplier, setUserCashOutMultiplier] = useState(0);
  
  // Ставки и история
  const [activeBets, setActiveBets] = useState([]);
  const [cashedOutBets, setCashedOutBets] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Таймеры для обратного отсчета
  const countdownTimerRef = useRef(null);

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
        const historyResponse = await gameApi.getCrashHistory();
        if (historyResponse.success) {
          setHistory(historyResponse.data);
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
      
      // Сбрасываем состояние ставки для нового раунда
      setHasBet(false);
      setCashedOut(false);
      setUserBet(null);
      setUserGameId(null);
      setUserCashOutMultiplier(0);
      
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
      
      // Если у пользователя была ставка и он не вывел
      if (hasBet && !cashedOut) {
        gameLoseFeedback();
        setGameResult({
          win: false,
          amount: userBet.amount,
          newBalance: balance
        });
      }
    });

    // Новая ставка
    const unsubBetPlaced = webSocketService.on('crash_bet_placed', (data) => {
      console.log('💰 Новая ставка:', data);
      
      // Добавляем только если это не наша ставка (уже добавлена локально)
      if (data.userId !== userTelegramId) {
        setActiveBets(prev => [...prev, {
          id: Date.now() + Math.random(),
          userId: data.userId,
          username: data.username || 'Игрок',
          amount: data.amount,
          autoCashOut: data.autoCashOut || 0,
          isCurrentUser: false
        }]);
      }
    });

    // Автоматический кешаут
    const unsubAutoCashOut = webSocketService.on('crash_auto_cash_out', (data) => {
      console.log('🤖 Автокешаут:', data);
      handleCashOutEvent(data);
    });

    // Ручной кешаут
    const unsubManualCashOut = webSocketService.on('crash_manual_cash_out', (data) => {
      console.log('💸 Ручной кешаут:', data);
      handleCashOutEvent(data);
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

    // Функция обработки кешаута - ИСПРАВЛЕННАЯ
    const handleCashOutEvent = (data) => {
      console.log('💸 Обработка кешаута:', data);
      
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
      
      // Если это наш кешаут, обновляем UI немедленно
      if (data.userId === userTelegramId) {
        console.log('Это наш кешаут! Обновляем UI');
        setCashedOut(true);
        setUserCashOutMultiplier(data.multiplier);
        
        // Обновляем баланс если передан
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
        // Показываем результат игры
        setGameResult({
          win: true,
          amount: data.amount * data.multiplier - data.amount, // Прибыль
          newBalance: data.balanceAfter
        });
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
  }, [isInitializing, hasBet, cashedOut, userBet, balance, userTelegramId, gameLoseFeedback, setGameResult, startCountdown, loadHistory, updateGameState]);

  // Обновление состояния игры - ИСПРАВЛЕННОЕ
  const updateGameState = useCallback((state) => {
    console.log('📊 Обновление состояния игры:', state);
    
    setGameState(state.status);
    setRoundId(state.roundId);
    
    // Обновляем множитель только если он валидный
    if (state.multiplier !== undefined && state.multiplier > 0) {
      setCurrentMultiplier(state.multiplier);
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
          id: `bet-${bet.userId}-${bet.amount}`,
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
        
        // Проверяем нашу ставку
        if (bet.userId === userTelegramId) {
          console.log('Найдена наша ставка:', bet);
          setHasBet(true);
          setCashedOut(bet.cashedOut || false);
          setUserBet({
            amount: bet.amount,
            autoCashOut: bet.autoCashOut || 0
          });
          if (bet.cashedOut && bet.cashOutMultiplier) {
            setUserCashOutMultiplier(bet.cashOutMultiplier);
          }
        }
      });
      
      console.log('Обновленные ставки:', { active, cashedOut });
      setActiveBets(active);
      setCashedOutBets(cashedOut);
    }
  }, [userTelegramId, startCountdown]);

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
      const response = await gameApi.getCrashHistory();
      if (response.success) {
        setHistory(response.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
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
      
      const response = await gameApi.placeCrashBet(betAmount, autoCashOut);
      
      if (response.success) {
        console.log('✅ Ставка размещена:', response.data);
        
        // Обновляем баланс немедленно
        setBalance(response.data.balanceAfter);
        
        // Обновляем состояние ставки
        setHasBet(true);
        setCashedOut(false);
        setUserBet({
          amount: betAmount,
          autoCashOut: autoCashOut
        });
        setUserGameId(response.data.gameId);
        
        // Немедленно добавляем нашу ставку в локальный список
        const userBetData = {
          id: `user-bet-${userTelegramId}`,
          userId: userTelegramId,
          username: 'Вы',
          amount: betAmount,
          autoCashOut: autoCashOut,
          isCurrentUser: true
        };
        
        setActiveBets(prev => {
          // Убираем старую ставку пользователя если есть
          const filtered = prev.filter(bet => bet.userId !== userTelegramId);
          return [...filtered, userBetData];
        });
      }
      
    } catch (err) {
      console.error('❌ Ошибка размещения ставки:', err);
      setError(err.response?.data?.message || 'Ошибка размещения ставки');
    } finally {
      setLoading(false);
    }
  }, [gameState, hasBet, betAmount, balance, loading, autoCashOut, userTelegramId, setBalance, setError, gameActionFeedback]);

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

  // Получение текста для главной кнопки
  const getMainButtonText = () => {
    if (loading) return 'Загрузка...';
    
    switch (gameState) {
      case 'waiting':
        if (hasBet && userBet) return `Ставка размещена (${userBet.amount || 0} USDT)`;
        return `Поставить ${betAmount || 0} USDT`;
      case 'flying':
        if (!hasBet) return 'Ставка не размещена';
        if (cashedOut && userCashOutMultiplier !== undefined) return `Выведено при ${userCashOutMultiplier.toFixed(2)}x`;
        if (userBet) return `Вывести (${((userBet.amount || 0) * (currentMultiplier || 1)).toFixed(2)} USDT)`;
        return 'Вывести';
      case 'crashed':
        if (hasBet && !cashedOut) return 'Проигрыш';
        if (hasBet && cashedOut && userCashOutMultiplier !== undefined) return `Выигрыш ${userCashOutMultiplier.toFixed(2)}x`;
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
        if (!hasBet) {
          placeBet();
        }
        break;
      case 'flying':
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