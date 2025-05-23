// frontend/src/components/games/slots/SlotGame.js
import React, { useState, useEffect, useCallback } from 'react';
import SlotMachine from './SlotMachine';
import SlotControls from './SlotControls';
import { gameApi } from '../../../services';

const SlotGame = ({ 
  balance, 
  setBalance, 
  gameStats, 
  setGameResult, 
  setError 
}) => {
  // Состояние игры
  const [isSpinning, setIsSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  
  // Состояние автоигры
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayCount, setAutoplayCount] = useState(10);
  const [autoplayRemaining, setAutoplayRemaining] = useState(0);
  const [autoplayTimeoutId, setAutoplayTimeoutId] = useState(null);
  
  // ИСПРАВЛЕНО: функция для выполнения спина
  const performSpin = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance || loading || isSpinning) {
      return false;
    }
    
    try {
      console.log('СЛОТЫ ИГРА: Начинаем спин с ставкой:', betAmount);
      setLoading(true);
      setIsSpinning(true);
      setError(null);
      
      // КРИТИЧНО: Очищаем предыдущий результат ПЕРЕД запросом
      setLastResult(null);
      
      // Отправляем запрос на сервер
      const response = await gameApi.playSlots(betAmount);
      const data = response.data.data;
      
      console.log('СЛОТЫ ИГРА: Получен результат с сервера:', data);
      
      // КРИТИЧНО: Проверяем, что все данные на месте
      if (!data.reels || !Array.isArray(data.reels)) {
        throw new Error('Сервер вернул некорректные данные барабанов');
      }
      
      // Ждем завершения анимации (2.8 секунды)
      setTimeout(() => {
        console.log('СЛОТЫ ИГРА: Анимация завершена, устанавливаем результат');
        
        // КРИТИЧНО: Устанавливаем результат только после анимации
        setLastResult({
          reels: data.reels,
          winningLines: data.winningLines || [],
          win: data.win,
          profit: data.profit,
          multiplier: data.multiplier || 0,
          winningSymbols: data.winningSymbols || []
        });
        
        // Обновляем баланс
        if (data.balanceAfter !== undefined) {
          console.log('СЛОТЫ ИГРА: Обновляем баланс:', data.balanceAfter);
          setBalance(data.balanceAfter);
        }
        
        // Показываем результат в интерфейсе игры
        setGameResult({
          win: data.win,
          amount: data.win ? Math.abs(data.profit) : betAmount,
          newBalance: data.balanceAfter
        });
        
        // Завершаем спин
        setIsSpinning(false);
        setLoading(false);
        
        console.log('СЛОТЫ ИГРА: Спин полностью завершен');
      }, 2800); // Время анимации + небольшая задержка
      
      return data.win;
    } catch (err) {
      console.error('СЛОТЫ ИГРА: Ошибка спина:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsSpinning(false);
      setLoading(false);
      setLastResult(null);
      return false;
    }
  }, [betAmount, balance, loading, isSpinning, setBalance, setError, setGameResult]);
  
  // Обработчик обычного спина
  const handleSpin = useCallback(async () => {
    if (!autoplay && !isSpinning && !loading) {
      console.log('СЛОТЫ ИГРА: Ручной спин');
      await performSpin();
    }
  }, [autoplay, isSpinning, loading, performSpin]);
  
  // Функция автоигры
  const performAutoplay = useCallback(async () => {
    if (!autoplay || autoplayRemaining <= 0 || betAmount > balance || isSpinning || loading) {
      setAutoplay(false);
      setAutoplayRemaining(0);
      return;
    }
    
    console.log('СЛОТЫ ИГРА: Автоспин, осталось:', autoplayRemaining);
    const won = await performSpin();
    setAutoplayRemaining(prev => prev - 1);
    
    // Если выиграли большую сумму (больше 10x), останавливаем автоигру
    if (won && lastResult && Math.abs(lastResult.profit) > betAmount * 10) {
      console.log('СЛОТЫ ИГРА: Большой выигрыш, останавливаем автоигру');
      setAutoplay(false);
      setAutoplayRemaining(0);
      return;
    }
    
    // Планируем следующий спин
    if (autoplayRemaining > 1 && betAmount <= balance) {
      const timeoutId = setTimeout(() => {
        performAutoplay();
      }, 3500); // Увеличили задержку для автоигры
      setAutoplayTimeoutId(timeoutId);
    } else {
      setAutoplay(false);
      setAutoplayRemaining(0);
    }
  }, [autoplay, autoplayRemaining, betAmount, balance, isSpinning, loading, performSpin, lastResult]);
  
  // Эффект для запуска автоигры
  useEffect(() => {
    if (autoplay && autoplayRemaining > 0 && !isSpinning && !loading) {
      performAutoplay();
    }
    
    return () => {
      if (autoplayTimeoutId) {
        clearTimeout(autoplayTimeoutId);
      }
    };
  }, [autoplay, autoplayRemaining, isSpinning, loading, performAutoplay, autoplayTimeoutId]);
  
  // Обработчик включения автоигры
  const handleAutoplayToggle = useCallback((enabled) => {
    console.log('СЛОТЫ ИГРА: Автоигра', enabled ? 'включена' : 'выключена');
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
