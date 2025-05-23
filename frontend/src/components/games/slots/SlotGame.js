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
  
  // Функция для выполнения спина
  const performSpin = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance || loading) {
      return false;
    }
    
    try {
      setLoading(true);
      setIsSpinning(true);
      setLastResult(null);
      setError(null);
      
      // Отправляем запрос на сервер
      const response = await gameApi.playSlots(betAmount);
      const data = response.data.data;
      
      // Имитируем время вращения барабанов (2.5 секунды для 4x4)
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Обновляем результат
      setLastResult({
        reels: data.reels,
        winningLines: data.winningLines,
        win: data.win,
        winAmount: data.win ? Math.abs(data.profit) : 0,
        winningSymbols: data.winningSymbols || []
      });
      
      // Обновляем баланс
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Отображаем результат игры
      setGameResult({
        win: data.win,
        amount: data.win ? Math.abs(data.profit) : betAmount,
        newBalance: data.balanceAfter
      });
      
      setIsSpinning(false);
      setLoading(false);
      
      return data.win;
    } catch (err) {
      console.error('Ошибка спина:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsSpinning(false);
      setLoading(false);
      return false;
    }
  }, [betAmount, balance, setBalance, setError, setGameResult]);
  
  // Обработчик обычного спина
  const handleSpin = useCallback(async () => {
    if (!autoplay) {
      await performSpin();
    }
  }, [autoplay, performSpin]);
  
  // Функция автоигры
  const performAutoplay = useCallback(async () => {
    if (!autoplay || autoplayRemaining <= 0 || betAmount > balance) {
      setAutoplay(false);
      setAutoplayRemaining(0);
      return;
    }
    
    const won = await performSpin();
    setAutoplayRemaining(prev => prev - 1);
    
    // Если выиграли большую сумму (больше 10x), останавливаем автоигру
    if (won && lastResult && lastResult.winAmount > betAmount * 10) {
      setAutoplay(false);
      setAutoplayRemaining(0);
      return;
    }
    
    // Планируем следующий спин через 1.5 секунды
    if (autoplayRemaining > 1 && betAmount <= balance) {
      const timeoutId = setTimeout(() => {
        performAutoplay();
      }, 1500);
      setAutoplayTimeoutId(timeoutId);
    } else {
      setAutoplay(false);
      setAutoplayRemaining(0);
    }
  }, [autoplay, autoplayRemaining, betAmount, balance, performSpin, lastResult]);
  
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
