// frontend/src/components/games/slots/SlotGame.js
import React, { useState, useEffect, useCallback } from 'react';
import SlotMachine from './SlotMachine';
import SlotControls from './SlotControls';
import { gameApi } from '../../../services';
import '../../../styles/SlotGame.css';

const SlotGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError 
}) => {
  // НОВОЕ: Состояние загрузки
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Состояние игры
  const [isSpinning, setIsSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [animationComplete, setAnimationComplete] = useState(true);
  
  // Состояние автоигры
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayCount, setAutoplayCount] = useState(10);
  const [autoplayRemaining, setAutoplayRemaining] = useState(0);
  const [autoplayTimeoutId, setAutoplayTimeoutId] = useState(null);
  
  // НОВОЕ: Инициализация с загрузочным экраном
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Показываем загрузочный экран минимум 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ СЛОТ ИГРЫ ===');
        setIsInitializing(false);
        
      } catch (err) {
        console.error('Ошибка инициализации слотов:', err);
        setError('Ошибка загрузки игры');
        setIsInitializing(false);
      }
    };
    
    initializeGame();
  }, [setError]);
  
  // Обработчик завершения анимации
  const handleAnimationComplete = useCallback(() => {
    console.log('СЛОТЫ: Анимация завершена в SlotGame');
    setAnimationComplete(true);
    setIsSpinning(false);
    setLoading(false);
  }, []);
  
  // Функция для выполнения спина
  const performSpin = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance || loading || isSpinning || !animationComplete) {
      console.log('СЛОТЫ: Спин заблокирован:', { betAmount, balance, loading, isSpinning, animationComplete });
      return false;
    }
    
    try {
      console.log('СЛОТЫ: Начинаем спин с ставкой:', betAmount);
      setLoading(true);
      setIsSpinning(true);
      setAnimationComplete(false);
      setError(null);
      
      // Очищаем предыдущий результат
      setLastResult(null);
      
      // Отправляем запрос на сервер
      const response = await gameApi.playSlots(betAmount);
      const data = response.data.data;
      
      console.log('СЛОТЫ: Получен результат с сервера:', data);
      
      // Проверяем корректность данных
      if (!data.reels || !Array.isArray(data.reels)) {
        throw new Error('Сервер вернул некорректные данные барабанов');
      }
      
      // Передаем результат в SlotMachine для запуска анимации
      setLastResult({
        reels: data.reels,
        winningLines: data.winningLines || [],
        win: data.win,
        profit: data.profit,
        multiplier: data.multiplier || 0,
        winningSymbols: data.winningSymbols || []
      });
      
      // Обновляем баланс после получения ответа
      if (data.balanceAfter !== undefined) {
        console.log('СЛОТЫ: Обновляем баланс:', data.balanceAfter);
        setBalance(data.balanceAfter);
      }
      
      // Показываем результат в GameScreen
      setGameResult({
        win: data.win,
        amount: data.win ? Math.abs(data.profit) : betAmount,
        newBalance: data.balanceAfter
      });
      
      return data.win;
    } catch (err) {
      console.error('СЛОТЫ: Ошибка спина:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsSpinning(false);
      setLoading(false);
      setAnimationComplete(true);
      setLastResult(null);
      return false;
    }
  }, [betAmount, balance, loading, isSpinning, animationComplete, setBalance, setError, setGameResult]);
  
  // Обработчик обычного спина
  const handleSpin = useCallback(async () => {
    if (!autoplay && !isSpinning && !loading && animationComplete) {
      console.log('СЛОТЫ: Ручной спин');
      await performSpin();
    }
  }, [autoplay, isSpinning, loading, animationComplete, performSpin]);
  
  // Функция автоигры
  const performAutoplay = useCallback(async () => {
    if (!autoplay || autoplayRemaining <= 0 || betAmount > balance || isSpinning || loading || !animationComplete) {
      setAutoplay(false);
      setAutoplayRemaining(0);
      return;
    }
    
    console.log('СЛОТЫ: Автоспин, осталось:', autoplayRemaining);
    const won = await performSpin();
    setAutoplayRemaining(prev => prev - 1);
    
    // Если выиграли большую сумму (больше 10x), останавливаем автоигру
    if (won && lastResult && Math.abs(lastResult.profit) > betAmount * 10) {
      console.log('СЛОТЫ: Большой выигрыш, останавливаем автоигру');
      setAutoplay(false);
      setAutoplayRemaining(0);
      return;
    }
    
    // Планируем следующий спин только после завершения анимации
    if (autoplayRemaining > 1 && betAmount <= balance) {
      const timeoutId = setTimeout(() => {
        if (animationComplete) {
          performAutoplay();
        }
      }, 1000);
      setAutoplayTimeoutId(timeoutId);
    } else {
      setAutoplay(false);
      setAutoplayRemaining(0);
    }
  }, [autoplay, autoplayRemaining, betAmount, balance, isSpinning, loading, animationComplete, performSpin, lastResult]);
  
  // Эффект для запуска автоигры
  useEffect(() => {
    if (autoplay && autoplayRemaining > 0 && !isSpinning && !loading && animationComplete) {
      const autoplayTimeout = setTimeout(() => {
        performAutoplay();
      }, 500);
      
      return () => clearTimeout(autoplayTimeout);
    }
    
    return () => {
      if (autoplayTimeoutId) {
        clearTimeout(autoplayTimeoutId);
      }
    };
  }, [autoplay, autoplayRemaining, isSpinning, loading, animationComplete, performAutoplay, autoplayTimeoutId]);
  
  // Обработчик включения автоигры
  const handleAutoplayToggle = useCallback((enabled) => {
    console.log('СЛОТЫ: Автоигра', enabled ? 'включена' : 'выключена');
    if (enabled) {
      setAutoplayRemaining(autoplayCount);
    } else {
      if (autoplayTimeoutId) {
        clearTimeout(autoplayTimeoutId);
        setAutoplayTimeoutId(null);
      }
      setAutoplayRemaining(0);
    }
    setAutoplay(enabled);
  }, [autoplayCount, autoplayTimeoutId]);
  
  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (autoplayTimeoutId) {
        clearTimeout(autoplayTimeoutId);
      }
    };
  }, [autoplayTimeoutId]);
  
  // НОВОЕ: Загрузочный экран для слотов
  if (isInitializing) {
    return (
      <div className="slots-loading-screen">
        <div className="slots-loading-content">
          <div className="greenlight-logo">
            <div className="logo-icon slots-icon">🎰</div>
            <div className="logo-text">Greenlight</div>
            <div className="logo-subtitle">Slot Machine</div>
          </div>
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <div className="loading-text">Загрузка слотов...</div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <SlotMachine 
        onSpin={handleSpin}
        isSpinning={isSpinning}
        balance={balance}
        betAmount={betAmount}
        lastResult={lastResult}
        autoplay={autoplay}
        loading={loading}
        gameStats={gameStats}
        onAnimationComplete={handleAnimationComplete}
      />
      
      <SlotControls 
        balance={balance}
        onSpin={handleSpin}
        isSpinning={isSpinning}
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        autoplay={autoplay}
        setAutoplay={handleAutoplayToggle}
        autoplayCount={autoplayCount}
        setAutoplayCount={setAutoplayCount}
        loading={loading}
        autoplayRemaining={autoplayRemaining}
        gameStats={gameStats}
      />
    </>
  );
};

export default SlotGame;
