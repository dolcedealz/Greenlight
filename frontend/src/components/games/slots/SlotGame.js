// frontend/src/components/games/slots/SlotGame.js - ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ
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

  // НОВОЕ: Состояние производительности устройства
  const [isLowPerformance, setIsLowPerformance] = useState(false);

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
        // НОВОЕ: Проверка производительности устройства
        const checkPerformance = () => {
          const start = performance.now();
          // Простой тест производительности
          for (let i = 0; i < 10000; i++) {
            Math.random() * Math.sin(i) * Math.cos(i);
          }
          const end = performance.now();
          const isLow = (end - start) > 12; // Если операция заняла больше 12ms
          setIsLowPerformance(isLow);
          console.log('🎰 PERFORMANCE: Устройство', isLow ? 'слабое' : 'мощное', `(${(end - start).toFixed(2)}ms)`);
        };

        checkPerformance();

        await new Promise(resolve => setTimeout(resolve, 2000));

        setIsInitializing(false);
      } catch (err) {

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

    setAnimationComplete(true);
    setIsSpinning(false);
    setLoading(false);
  }, []);

  // Функция для выполнения спина
  const performSpin = useCallback(async () => {
    if (betAmount <= 0 || betAmount > balance || loading || isSpinning || !animationComplete) {

      return { success: false, win: false };
    }

    try {

      setLoading(true);
      setIsSpinning(true);
      setAnimationComplete(false);
      setError(null);
      setLastResult(null);

      // Отправляем запрос на сервер
      const response = await gameApi.playSlots(betAmount);
      const data = response.data.data;

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

      await performSpin();
    }
  }, [autoplay, isSpinning, loading, animationComplete, performSpin]);

  // Функция остановки автоспина остается для кнопки остановки

  // Обработчик включения/выключения автоигры - ИСПРАВЛЕННЫЙ
  const handleAutoplayToggle = useCallback((newAutoplayState) => {

    if (newAutoplayState) {
      // Включаем автоспин

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

            isAutoplayActiveRef.current = false;
            setAutoplay(false);
            setAutoplayRemaining(0);
          }
        }
      }, 500);
    } else {
      // Выключаем автоспин

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

      // Очищаем предыдущий таймаут
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }

      // Планируем следующий спин
      autoplayTimeoutRef.current = setTimeout(async () => {
        if (isAutoplayActiveRef.current && autoplayRemaining > 0) {

          const spinResult = await performSpin();

          if (spinResult.success) {
            // Уменьшаем счетчик после успешного спина
            setAutoplayRemaining(prev => {
              const newCount = prev - 1;

              // Если спины закончились, останавливаем автоспин
              if (newCount <= 0) {

                isAutoplayActiveRef.current = false;
                setAutoplay(false);
              }

              return newCount;
            });
          } else {
            // При ошибке останавливаем автоспин

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
    <div className={`slots-game ${isLowPerformance ? 'low-performance' : ''}`}>
      {/* Основной контент */}
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
        isLowPerformance={isLowPerformance}
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
        onStopAutoplay={stopAutoplay}
      />
    </div>
  );
};

export default SlotGame;
