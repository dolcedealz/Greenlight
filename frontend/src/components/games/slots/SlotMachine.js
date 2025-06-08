// frontend/src/components/games/slots/SlotMachine.js - ИСПРАВЛЕННАЯ АНИМАЦИЯ
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../../styles/SlotMachine.css';
// ОБНОВЛЕННЫЕ КОЭФФИЦИЕНТЫ (дополнительно урезаны на 20% кроме jackpot)
const SLOT_SYMBOLS = [
  { symbol: 'cherry', name: 'cherry', weight: 25, payout: 1.6, emoji: '🍒' },
  { symbol: 'lemon', name: 'lemon', weight: 20, payout: 2.4, emoji: '🍋' },
  { symbol: 'persik', name: 'persik', weight: 15, payout: 3.2, emoji: '🍑' },
  { symbol: 'grape', name: 'grape', weight: 12, payout: 4.8, emoji: '🍇' },
  { symbol: 'bell', name: 'bell', weight: 8, payout: 7.2, emoji: '🔔' },
  { symbol: 'diamond', name: 'diamond', weight: 5, payout: 12, emoji: '💎' },
  { symbol: 'star', name: 'star', weight: 3, payout: 20, emoji: '⭐' },
  { symbol: 'jackpot', name: 'jackpot', weight: 2, payout: 50, emoji: '🎰' }
];
const SlotMachine = ({ 
  onSpin, 
  isSpinning, 
  balance, 
  betAmount,
  lastResult,
  autoplay,
  loading,
  gameStats,
  onAnimationComplete
}) => {
  // Начальное состояние барабанов
  const [reels, setReels] = useState(() => [
    ['cherry', 'lemon', 'persik', 'grape'],
    ['cherry', 'lemon', 'persik', 'grape'],
    ['cherry', 'lemon', 'persik', 'grape'],
    ['cherry', 'lemon', 'persik', 'grape']
  ]);
  // Состояния анимации
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingReels, setAnimatingReels] = useState([false, false, false, false]);
  const [winningLines, setWinningLines] = useState([]);
  const [showingResult, setShowingResult] = useState(false);
  const [spinPhase, setSpinPhase] = useState('idle');
  // Рефы для управления анимацией
  const animationFrames = useRef([]);
  const animationTimeouts = useRef([]);
  const lastResultRef = useRef(null);
  const finalResultRef = useRef(null);
  const isStoppingRef = useRef(false);
  const animationCompleteRef = useRef(false);
  const frameCounters = useRef([0, 0, 0, 0]); // Счетчики кадров для каждого барабана
  // ОПТИМИЗАЦИЯ: Детектор производительности устройства
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  useEffect(() => {
    // Проверка производительности устройства
    const checkPerformance = () => {
      const start = performance.now();
      for (let i = 0; i < 5000; i++) {
        Math.random();
      }
      const end = performance.now();
      const isLow = (end - start) > 8; // Если операция заняла больше 8ms
      setIsLowPerformance(isLow);
      console.log('🎰 PERFORMANCE: Устройство', isLow ? 'слабое' : 'мощное', `(${(end - start).toFixed(2)}ms)`);
    };
    checkPerformance();
  }, []);
  // Получить данные символа
  const getSymbolData = useCallback((symbolName) => {
    return SLOT_SYMBOLS.find(s => s.symbol === symbolName) || SLOT_SYMBOLS[0];
  }, []);
  // Генерация случайного символа для анимации
  const getRandomSymbol = useCallback(() => {
    const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const symbolData of SLOT_SYMBOLS) {
      random -= symbolData.weight;
      if (random <= 0) {
        return symbolData.symbol;
      }
    }
    return SLOT_SYMBOLS[0].symbol;
  }, []);
  // Очистка анимаций
  const clearAnimations = useCallback(() => {
    animationFrames.current.forEach((frameId, index) => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    });
    animationFrames.current = [];
    frameCounters.current = [0, 0, 0, 0];
    animationTimeouts.current.forEach((timeout, index) => {
      if (timeout) {
        clearTimeout(timeout);
      }
    });
    animationTimeouts.current = [];
  }, []);
  // Функция анимации одного барабана с requestAnimationFrame
  const animateReel = useCallback((reelIndex) => {
    if (isStoppingRef.current || animationCompleteRef.current) {
      return;
    }
    const animate = () => {
      // Увеличиваем счетчик кадров
      frameCounters.current[reelIndex]++;
      // ОПТИМИЗАЦИЯ: Обновляем символы не каждый кадр
      const frameSkip = isLowPerformance ? 8 : 4; // Для слабых устройств - каждый 8й кадр, для мощных - каждый 4й
      if (frameCounters.current[reelIndex] % frameSkip === 0) {
        setReels(prevReels => {
          if (isStoppingRef.current || animationCompleteRef.current) {
            return prevReels;
          }
          const newReels = [...prevReels];
          newReels[reelIndex] = Array(4).fill().map(() => getRandomSymbol());
          return newReels;
        });
      }
      // Продолжаем анимацию, если не остановлена
      if (!isStoppingRef.current && !animationCompleteRef.current) {
        animationFrames.current[reelIndex] = requestAnimationFrame(animate);
      }
    };
    // Запускаем анимацию
    animationFrames.current[reelIndex] = requestAnimationFrame(animate);
  }, [getRandomSymbol, isLowPerformance]);
  // Функция для полной остановки анимации
  const stopAllAnimations = useCallback(() => {
    clearAnimations();
    setIsAnimating(false);
    setAnimatingReels([false, false, false, false]);
    setSpinPhase('stopped');
    isStoppingRef.current = false;
    animationCompleteRef.current = true;
  }, [clearAnimations]);
  // Функция для плавной остановки барабана на нужном символе
  const stopReelWithResult = useCallback((reelIndex, targetColumn, delay) => {
    const timeout = setTimeout(() => {
      // Останавливаем анимацию для этого барабана
      if (animationFrames.current[reelIndex]) {
        cancelAnimationFrame(animationFrames.current[reelIndex]);
        animationFrames.current[reelIndex] = null;
      }
      // Устанавливаем финальные символы для этого барабана
      setReels(prevReels => {
        const newReels = [...prevReels];
        newReels[reelIndex] = [...targetColumn];
        return newReels;
      });
      // Отключаем анимацию для барабана
      setAnimatingReels(prev => {
        const newState = [...prev];
        newState[reelIndex] = false;
        return newState;
      });
      // Если это последний барабан
      if (reelIndex === 3) {
        // Завершаем анимацию
        setIsAnimating(false);
        setSpinPhase('stopped');
        isStoppingRef.current = false;
        animationCompleteRef.current = true;
        // Показываем результат через короткую задержку
        setTimeout(() => {
          setShowingResult(true);
          if (finalResultRef.current && finalResultRef.current.winningLines && finalResultRef.current.winningLines.length > 0) {
            setTimeout(() => {
              setWinningLines([...finalResultRef.current.winningLines]);
              // Убираем подсветку через 4 секунды
              setTimeout(() => {
                setWinningLines([]);
              }, 4000);
            }, 300);
          }
          // Уведомляем родительский компонент ПОСЛЕ визуального завершения
          setTimeout(() => {
            if (onAnimationComplete) {
              onAnimationComplete();
            }
          }, 800);
        }, 200);
      }
    }, delay);
    animationTimeouts.current.push(timeout);
  }, [onAnimationComplete]);
  // Сброс состояния при начале нового спина
  useEffect(() => {
    if (isSpinning && !isAnimating && !animationCompleteRef.current) {
      // Сбрасываем все состояния
      clearAnimations();
      setWinningLines([]);
      setShowingResult(false);
      setIsAnimating(true);
      setSpinPhase('spinning');
      setAnimatingReels([true, true, true, true]);
      isStoppingRef.current = false;
      finalResultRef.current = null;
      lastResultRef.current = null;
      animationCompleteRef.current = false;
      frameCounters.current = [0, 0, 0, 0];
      // Запускаем анимацию для каждого барабана
      for (let reelIndex = 0; reelIndex < 4; reelIndex++) {
        animateReel(reelIndex);
      }
    }
  }, [isSpinning, isAnimating, clearAnimations, animateReel]);
  // Обработка результата с сервера
  useEffect(() => {
    if (lastResult && 
        lastResult !== lastResultRef.current && 
        lastResult.reels && 
        isAnimating && 
        !isStoppingRef.current &&
        !animationCompleteRef.current) {
      lastResultRef.current = lastResult;
      finalResultRef.current = lastResult;
      isStoppingRef.current = true;
      setSpinPhase('stopping');
      // ОПТИМИЗАЦИЯ: Адаптивные задержки между остановками барабанов
      const stopDelays = isLowPerformance ? [200, 350, 500, 650] : [300, 500, 700, 900];
      lastResult.reels.forEach((targetColumn, reelIndex) => {
        stopReelWithResult(reelIndex, targetColumn, stopDelays[reelIndex]);
      });
    }
  }, [lastResult, isAnimating, stopReelWithResult, isLowPerformance]);
  // Сброс состояния анимации при остановке спина
  useEffect(() => {
    if (!isSpinning && animationCompleteRef.current) {
      animationCompleteRef.current = false;
    }
  }, [isSpinning]);
  // Аварийная остановка анимации
  useEffect(() => {
    if (!isSpinning && isAnimating) {
      const emergencyTimeout = setTimeout(() => {
        stopAllAnimations();
      }, 500);
      return () => clearTimeout(emergencyTimeout);
    }
  }, [isSpinning, isAnimating, stopAllAnimations]);
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      clearAnimations();
    };
  }, [clearAnimations]);
  // Определение класса ячейки
  const getCellClass = useCallback((reelIndex, rowIndex) => {
    const baseClass = 'slot-cell';
    const position = `${reelIndex}-${rowIndex}`;
    if (winningLines.length > 0) {
      const isWinning = winningLines.some(line => line.includes(position));
      if (isWinning) {
        return `${baseClass} winning`;
      }
    }
    return baseClass;
  }, [winningLines]);
  // ОПТИМИЗАЦИЯ: Мемоизированный компонент символа
  const SymbolComponent = React.memo(({ symbolName }) => {
    const symbolData = getSymbolData(symbolName);
    return <span className="slot-symbol">{symbolData.emoji}</span>;
  });
  return (
    <div className={`slot-machine ${isLowPerformance ? 'low-performance' : ''}`}>
      {/* Игровое поле 4x4 */}
      <div className="slot-display">
        <div className="slot-reels">
          {reels.map((reel, reelIndex) => (
            <div 
              key={reelIndex} 
              className={`slot-reel ${animatingReels[reelIndex] ? 'spinning' : ''} ${spinPhase}`}
            >
              {reel.map((symbolName, rowIndex) => (
                <div
                  key={`${reelIndex}-${rowIndex}`}
                  className={getCellClass(reelIndex, rowIndex)}
                  data-position={`${reelIndex}-${rowIndex}`}
                >
                  <SymbolComponent symbolName={symbolName} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* ОПТИМИЗАЦИЯ: Упрощенные линии выплат только для мощных устройств */}
        {!isLowPerformance && winningLines.length > 0 && (
          <div className="paylines">
            {/* Показываем только активные линии */}
            {winningLines.map((line, index) => (
              <div key={index} className="payline active" style={{
                // Простая стилизация без сложных анимаций
                position: 'absolute',
                background: 'rgba(11, 168, 74, 0.8)',
                height: '2px',
                borderRadius: '1px',
                zIndex: 10
              }}></div>
            ))}
          </div>
        )}
      </div>
      {/* Информация о результате */}
      {showingResult && finalResultRef.current && !isSpinning && !isAnimating && (
        <div className="last-spin-info">
          {finalResultRef.current.win ? (
            <div className="win-display">
              <span className="win-text">💰 ВЫИГРЫШ! 💰</span>
              <span className="win-amount">+{(Math.abs(finalResultRef.current.profit) || 0).toFixed(2)} USDT</span>
              {finalResultRef.current.winningSymbols && finalResultRef.current.winningSymbols.length > 0 && (
                <div className="winning-symbols">
                  {finalResultRef.current.winningSymbols.map((symbolName, index) => {
                    const symbolData = getSymbolData(symbolName);
                    return (
                      <span key={index} className="winning-symbol">
                        {symbolData.emoji}
                      </span>
                    );
                  })}
                </div>
              )}
              {finalResultRef.current.winningLines && finalResultRef.current.winningLines.length > 0 && (
                <>
                  <div className="winning-lines-count">
                    🎯 Выигрышных линий: {finalResultRef.current.winningLines.length} | Множитель: ×{(finalResultRef.current.multiplier || 0).toFixed(2)}
                  </div>
                  <div className="winning-lines-details">
                    {finalResultRef.current.winningLines.map((line, index) => {
                      // Определяем тип линии
                      let lineType = 'Неизвестная';
                      if (line.length >= 3) {
                        const firstPos = line[0].split('-');
                        const lastPos = line[line.length - 1].split('-');
                        if (firstPos[1] === lastPos[1]) {
                          lineType = `Строка ${parseInt(firstPos[1]) + 1}`;
                        }
                        else if (line.every((pos, i) => {
                          const [col, row] = pos.split('-');
                          return col === String(i) && row === String(i);
                        })) {
                          lineType = 'Главная диагональ';
                        }
                        else if (line.every((pos, i) => {
                          const [col, row] = pos.split('-');
                          return col === String(i) && row === String(3 - i);
                        })) {
                          lineType = 'Побочная диагональ';
                        }
                      }
                      return (
                        <div key={index} className="line-detail">
                          • {lineType}: {line.length} в ряд
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="lose-display">
              <span className="lose-text">🎯 Удача в следующий раз!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default SlotMachine;