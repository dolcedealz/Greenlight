// frontend/src/components/games/slots/SlotMachine.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../../styles/SlotMachine.css';

// Символы слотов только с эмодзи
const SLOT_SYMBOLS = [
  { symbol: 'cherry', name: 'cherry', weight: 25, payout: 4, emoji: '🍒' },
  { symbol: 'lemon', name: 'lemon', weight: 20, payout: 6, emoji: '🍋' },
  { symbol: 'persik', name: 'persik', weight: 15, payout: 8, emoji: '🍑' },
  { symbol: 'grape', name: 'grape', weight: 12, payout: 12, emoji: '🍇' },
  { symbol: 'bell', name: 'bell', weight: 8, payout: 18, emoji: '🔔' },
  { symbol: 'diamond', name: 'diamond', weight: 5, payout: 30, emoji: '💎' },
  { symbol: 'star', name: 'star', weight: 3, payout: 50, emoji: '⭐' },
  { symbol: 'jackpot', name: 'jackpot', weight: 2, payout: 100, emoji: '🎰' }
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
  onAnimationComplete // НОВЫЙ PROP для уведомления о завершении анимации
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
  const animationIntervals = useRef([]);
  const animationTimeouts = useRef([]);
  const lastResultRef = useRef(null);
  const finalResultRef = useRef(null);
  const isStoppingRef = useRef(false);
  const animationCompleteRef = useRef(false);
  
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
  
  // Очистка таймаутов и интервалов
  const clearAnimations = useCallback(() => {
    console.log('СЛОТЫ: Очищаем все анимации');
    
    animationIntervals.current.forEach((interval, index) => {
      if (interval) {
        clearInterval(interval);
        console.log(`СЛОТЫ: Очищен интервал ${index}`);
      }
    });
    animationIntervals.current = [];
    
    animationTimeouts.current.forEach((timeout, index) => {
      if (timeout) {
        clearTimeout(timeout);
        console.log(`СЛОТЫ: Очищен таймаут ${index}`);
      }
    });
    animationTimeouts.current = [];
  }, []);
  
  // НОВАЯ функция для полной остановки анимации
  const stopAllAnimations = useCallback(() => {
    console.log('СЛОТЫ: Принудительная остановка всех анимаций');
    
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
      console.log(`СЛОТЫ: Останавливаем барабан ${reelIndex} на символах:`, targetColumn);
      
      // Останавливаем интервал для этого барабана
      if (animationIntervals.current[reelIndex]) {
        clearInterval(animationIntervals.current[reelIndex]);
        animationIntervals.current[reelIndex] = null;
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
        console.log('СЛОТЫ: Все барабаны остановлены');
        
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
          
          // ИСПРАВЛЕНИЕ: Уведомляем родительский компонент ПОСЛЕ визуального завершения
          setTimeout(() => {
            if (onAnimationComplete) {
              console.log('СЛОТЫ: Вызываем onAnimationComplete после показа результата');
              onAnimationComplete();
            }
          }, 800); // Задержка для полного визуального завершения
        }, 200);
      }
    }, delay);
    
    animationTimeouts.current.push(timeout);
  }, [onAnimationComplete]);
  
  // Сброс состояния при начале нового спина
  useEffect(() => {
    if (isSpinning && !isAnimating && !animationCompleteRef.current) {
      console.log('СЛОТЫ: Запуск новой анимации');
      
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
      
      // Запускаем анимацию быстрой смены символов
      const intervals = [];
      
      for (let reelIndex = 0; reelIndex < 4; reelIndex++) {
        const interval = setInterval(() => {
          // Не обновляем барабан если уже начался процесс остановки
          if (isStoppingRef.current || animationCompleteRef.current) {
            return;
          }
          
          setReels(prevReels => {
            const newReels = [...prevReels];
            newReels[reelIndex] = Array(4).fill().map(() => getRandomSymbol());
            return newReels;
          });
        }, 100); // Фиксированная скорость
        
        intervals.push(interval);
      }
      
      animationIntervals.current = intervals;
    }
  }, [isSpinning, isAnimating, getRandomSymbol, clearAnimations, stopReelWithResult]);
  
  // ИСПРАВЛЕННАЯ обработка результата с сервера
  useEffect(() => {
    if (lastResult && 
        lastResult !== lastResultRef.current && 
        lastResult.reels && 
        isAnimating && 
        !isStoppingRef.current &&
        !animationCompleteRef.current) {
      
      console.log('СЛОТЫ: Получен результат с сервера, начинаем остановку:', lastResult);
      
      lastResultRef.current = lastResult;
      finalResultRef.current = lastResult;
      isStoppingRef.current = true;
      
      setSpinPhase('stopping');
      
      // Останавливаем барабаны поочередно с правильными символами
      const stopDelays = [400, 600, 800, 1000];
      
      lastResult.reels.forEach((targetColumn, reelIndex) => {
        stopReelWithResult(reelIndex, targetColumn, stopDelays[reelIndex]);
      });
    }
  }, [lastResult, isAnimating, stopReelWithResult]);
  
  // Сброс состояния анимации при остановке спина
  useEffect(() => {
    if (!isSpinning && animationCompleteRef.current) {
      console.log('СЛОТЫ: Спин завершен, сбрасываем флаг анимации');
      animationCompleteRef.current = false;
    }
  }, [isSpinning]);
  
  // Аварийная остановка анимации
  useEffect(() => {
    if (!isSpinning && isAnimating) {
      console.log('СЛОТЫ: Аварийная остановка анимации');
      const emergencyTimeout = setTimeout(() => {
        stopAllAnimations();
      }, 500);
      
      return () => clearTimeout(emergencyTimeout);
    }
  }, [isSpinning, isAnimating, stopAllAnimations]);
  
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      console.log('СЛОТЫ: Размонтирование компонента, очищаем все');
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
  
  // Компонент символа
  const SymbolComponent = React.memo(({ symbolName }) => {
    const symbolData = getSymbolData(symbolName);
    return <span className="slot-symbol">{symbolData.emoji}</span>;
  });
  
  return (
    <div className="slot-machine">
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
        
        {/* Линии выплат */}
        <div className="paylines">
          {/* Горизонтальные линии */}
          <div className={`payline horizontal line-1 ${winningLines.some(line => line.includes('0-0') && line.includes('1-0')) ? 'active' : ''}`}></div>
          <div className={`payline horizontal line-2 ${winningLines.some(line => line.includes('0-1') && line.includes('1-1')) ? 'active' : ''}`}></div>
          <div className={`payline horizontal line-3 ${winningLines.some(line => line.includes('0-2') && line.includes('1-2')) ? 'active' : ''}`}></div>
          <div className={`payline horizontal line-4 ${winningLines.some(line => line.includes('0-3') && line.includes('1-3')) ? 'active' : ''}`}></div>
          
          {/* Диагональные линии */}
          <div className={`payline diagonal line-main ${winningLines.some(line => line.includes('0-0') && line.includes('1-1') && line.includes('2-2')) ? 'active' : ''}`}></div>
          <div className={`payline diagonal line-anti ${winningLines.some(line => line.includes('0-3') && line.includes('1-2') && line.includes('2-1')) ? 'active' : ''}`}></div>
        </div>
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
                        
                        // Проверяем горизонтальную линию
                        if (firstPos[1] === lastPos[1]) {
                          lineType = `Строка ${parseInt(firstPos[1]) + 1}`;
                        }
                        // Проверяем главную диагональ
                        else if (line.every((pos, i) => {
                          const [col, row] = pos.split('-');
                          return col === String(i) && row === String(i);
                        })) {
                          lineType = 'Главная диагональ';
                        }
                        // Проверяем побочную диагональ
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
