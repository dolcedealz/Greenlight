// frontend/src/components/games/slots/SlotGame.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  // Состояние загрузки
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Состояние игры
  const [isSpinning, setIsSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [animationComplete, setAnimationComplete] = useState(true);
  
  // Состояние автоигры - ИСПРАВЛЕННОЕ
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayCount, setAutoplayCount] = useState(10);
  const [autoplayRemaining, setAutoplayRemaining] = useState(0);
  
  // Используем useRef для таймаутов вместо useState
  const autoplayTimeoutRef = useRef(null);
  const isAutoplayActiveRef = useRef(false);
  
  // Инициализация
  useEffect(() => {
    const initializeGame = async () => {
      try {
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
  
  // Очистка автоспина при размонтировании
  useEffect(() => {
    return () => {
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
        autoplayTimeoutRef.current = null;
      }
      isAutoplayActiveRef.current = false;
    };
  }, []);
  
  // Функция для остановки автоспина
  const stopAutoplay = useCallback(() => {
    console.log('СЛОТЫ: Остановка автоспина');
    
    // Очищаем таймаут
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    }
    
    // Обновляем состояние
    setAutoplay(false);
    setAutoplayRemaining(0);
    isAutoplayActiveRef.current = false;
  }, []);
  
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
      return { success: false, win: false };
    }
    
    try {
      console.log('СЛОТЫ: Начинаем спин с ставкой:', betAmount);
      setLoading(true);
      setIsSpinning(true);
      setAnimationComplete(false);
      setError(null);
      setLastResult(null);
      
      // Отправляем запрос на сервер
      const response = await gameApi.playSlots(betAmount);
      const data = response.data.data;
      
      console.log('СЛОТЫ: Получен результат с сервера:', data);
      
      if (!data.reels || !Array.isArray(data.reels)) {
        throw new Error('Сервер вернул некорректные данные барабанов');
      }
      
      // Передаем результат в SlotMachine
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
        console.log('СЛОТЫ: Обновляем баланс:', data.balanceAfter);
        setBalance(data.balanceAfter);
      }
      
      // Показываем результат
      setGameResult({
        win: data.win,
        amount: data.win ? Math.abs(data.profit) : betAmount,
        newBalance: data.balanceAfter
      });
      
      return { success: true, win: data.win, balanceAfter: data.balanceAfter };
    } catch (err) {
      console.error('СЛОТЫ: Ошибка спина:', err);
      setError(err.response?.data?.message || 'Произошла ошибка при игре');
      setIsSpinning(false);
      setLoading(false);
      setAnimationComplete(true);
      setLastResult(null);
      return { success: false, win: false };
    }
  }, [betAmount, balance, loading, isSpinning, animationComplete, setBalance, setError, setGameResult]);
  
  // Обработчик ручного спина
  const handleSpin = useCallback(async () => {
    if (!autoplay && !isSpinning && !loading && animationComplete) {
      console.log('СЛОТЫ: Ручной спин');
      await performSpin();
    }
  }, [autoplay, isSpinning, loading, animationComplete, performSpin]);
  
  // Функция остановки автоспина остается для кнопки остановки
  
  // Обработчик включения/выключения автоигры - ИСПРАВЛЕННЫЙ
  const handleAutoplayToggle = useCallback((newAutoplayState) => {
    console.log('СЛОТЫ: Переключение автоигры на:', newAutoplayState);
    
    if (newAutoplayState) {
      // Включаем автоспин
      console.log('СЛОТЫ: Включаем автоспин');
      
      // Очищаем предыдущий таймаут если есть
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
        autoplayTimeoutRef.current = null;
      }
      
      setAutoplay(true);
      setAutoplayRemaining(autoplayCount);
      isAutoplayActiveRef.current = true;
      
      // Запускаем первый спин через небольшую задержку
      autoplayTimeoutRef.current = setTimeout(async () => {
        if (isAutoplayActiveRef.current) {
          console.log('СЛОТЫ: Запускаем первый автоспин');
          
          // Проверяем условия прямо здесь, без вызова performSpin
          if (betAmount > 0 && betAmount <= balance && !isSpinning && !loading && animationComplete) {
            // Inline выполнение спина без зависимости от performSpin
            try {
              setLoading(true);
              setIsSpinning(true);
              setAnimationComplete(false);
              setError(null);
              setLastResult(null);
              
              const response = await gameApi.playSlots(betAmount);
              const data = response.data.data;
              
              if (!data.reels || !Array.isArray(data.reels)) {
                throw new Error('Сервер вернул некорректные данные барабанов');
              }
              
              setLastResult({
                reels: data.reels,
                winningLines: data.winningLines || [],
                win: data.win,
                profit: data.profit,
                multiplier: data.multiplier || 0,
                winningSymbols: data.winningSymbols || []
              });
              
              if (data.balanceAfter !== undefined) {
                setBalance(data.balanceAfter);
              }
              
              setGameResult({
                win: data.win,
                amount: data.win ? Math.abs(data.profit) : betAmount,
                newBalance: data.balanceAfter
              });
            } catch (err) {
              console.error('СЛОТЫ: Ошибка автоспина:', err);
              setError(err.response?.data?.message || 'Произошла ошибка при игре');
              setIsSpinning(false);
              setLoading(false);
              setAnimationComplete(true);
              setLastResult(null);
              // Останавливаем автоспин при ошибке
              isAutoplayActiveRef.current = false;
              setAutoplay(false);
              setAutoplayRemaining(0);
            }
          } else {
            console.log('СЛОТЫ: Условия для автоспина не выполнены, останавливаем');
            isAutoplayActiveRef.current = false;
            setAutoplay(false);
            setAutoplayRemaining(0);
          }
        }
      }, 500);
    } else {
      // Выключаем автоспин
      console.log('СЛОТЫ: Выключаем автоспин');
      
      // Очищаем таймаут
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
        autoplayTimeoutRef.current = null;
      }
      
      // Обновляем состояние
      setAutoplay(false);
      setAutoplayRemaining(0);
      isAutoplayActiveRef.current = false;
    }
  }, [autoplayCount]); // Убираем лишние зависимости
  
  // useEffect для продолжения автоспина после завершения спина
  useEffect(() => {
    // Запускаем следующий автоспин если:
    // 1. Автоспин активен
    // 2. Спин не выполняется
    // 3. Анимация завершена
    // 4. Есть оставшиеся спины
    if (isAutoplayActiveRef.current && 
        autoplay && 
        !isSpinning && 
        !loading && 
        animationComplete && 
        autoplayRemaining > 0 &&
        betAmount > 0 && 
        betAmount <= balance) {
      
      console.log('СЛОТЫ: Планируем следующий автоспин, осталось:', autoplayRemaining);
      
      // Очищаем предыдущий таймаут
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
      
      // Планируем следующий спин
      autoplayTimeoutRef.current = setTimeout(async () => {
        if (isAutoplayActiveRef.current && autoplayRemaining > 0) {
          console.log('СЛОТЫ: Выполняем автоспин');
          const spinResult = await performSpin();
          
          if (spinResult.success) {
            // Уменьшаем счетчик после успешного спина
            setAutoplayRemaining(prev => {
              const newCount = prev - 1;
              console.log('СЛОТЫ: Спинов осталось:', newCount);
              
              // Если спины закончились, останавливаем автоспин
              if (newCount <= 0) {
                console.log('СЛОТЫ: Все спины завершены, останавливаем автоспин');
                isAutoplayActiveRef.current = false;
                setAutoplay(false);
              }
              
              return newCount;
            });
          } else {
            // При ошибке останавливаем автоспин
            console.log('СЛОТЫ: Ошибка спина, останавливаем автоспин');
            isAutoplayActiveRef.current = false;
            setAutoplay(false);
            setAutoplayRemaining(0);
          }
        }
      }, 2000); // 2 секунды между спинами
    }
  }, [autoplay, isSpinning, loading, animationComplete, autoplayRemaining, betAmount, balance, performSpin]);
  
  // Загрузочный экран
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
        onStopAutoplay={stopAutoplay} // Новый проп
      />
    </>
  );
};

export default SlotGame;