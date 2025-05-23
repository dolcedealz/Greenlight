// frontend/src/components/games/slots/SlotMachine.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../../styles/SlotMachine.css';

// Символы слотов с весами и выплатами
const SLOT_SYMBOLS = [
  { symbol: '🍒', name: 'cherry', weight: 25, payout: 2 },
  { symbol: '🍋', name: 'lemon', weight: 20, payout: 3 },
  { symbol: '🍊', name: 'orange', weight: 15, payout: 4 },
  { symbol: '🍇', name: 'grape', weight: 12, payout: 5 },
  { symbol: '🔔', name: 'bell', weight: 8, payout: 8 },
  { symbol: '💎', name: 'diamond', weight: 5, payout: 15 },
  { symbol: '⭐', name: 'star', weight: 3, payout: 25 },
  { symbol: '🎰', name: 'jackpot', weight: 2, payout: 50 }
];

const SlotMachine = ({ 
  onSpin, 
  isSpinning, 
  balance, 
  betAmount,
  lastResult,
  autoplay,
  loading,
  gameStats 
}) => {
  // Состояние барабанов сохраняется между играми
  const [reels, setReels] = useState(() => {
    // Инициализация случайными символами
    return [
      ['🍒', '🍋', '🍊', '🍇'],
      ['🍒', '🍋', '🍊', '🍇'],
      ['🍒', '🍋', '🍊', '🍇'],
      ['🍒', '🍋', '🍊', '🍇']
    ];
  });
  
  // ИСПРАВЛЕНО: добавлены состояния для анимации
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingReels, setAnimatingReels] = useState([false, false, false, false]);
  const [winningLines, setWinningLines] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const lastResultRef = useRef(null);
  const winningTimeoutRef = useRef(null);
  const animationTimeoutRefs = useRef([]);
  
  // Функция для генерации случайного символа для анимации
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
  
  // ИСПРАВЛЕНО: Очистка состояния при начале нового спина
  useEffect(() => {
    if (isSpinning && !isAnimating) {
      console.log('Спин начался - запускаем анимацию');
      
      // Очищаем предыдущие таймауты
      animationTimeoutRefs.current.forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      animationTimeoutRefs.current = [];
      
      if (winningTimeoutRef.current) {
        clearTimeout(winningTimeoutRef.current);
        winningTimeoutRef.current = null;
      }
      
      // Очищаем выигрышные линии
      setWinningLines([]);
      setFinalResult(null);
      lastResultRef.current = null;
      
      // Запускаем анимацию вращения
      setIsAnimating(true);
      setAnimatingReels([true, true, true, true]);
      
      // Запускаем анимацию барабанов
      const animationIntervals = [];
      
      // Для каждого барабана создаем интервал с быстрой сменой символов
      reels.forEach((_, reelIndex) => {
        const interval = setInterval(() => {
          setReels(prev => {
            const newReels = [...prev];
            newReels[reelIndex] = [
              getRandomSymbol(),
              getRandomSymbol(),
              getRandomSymbol(),
              getRandomSymbol()
            ];
            return newReels;
          });
        }, 100); // Меняем символы каждые 100мс
        
        animationIntervals.push(interval);
      });
      
      // Останавливаем анимацию через 2 секунды
      const stopAnimationTimeout = setTimeout(() => {
        // Очищаем все интервалы
        animationIntervals.forEach(interval => clearInterval(interval));
        
        // Останавливаем анимацию барабанов поочередно
        const delays = [0, 200, 400, 600];
        
        delays.forEach((delay, index) => {
          const timeout = setTimeout(() => {
            setAnimatingReels(prev => {
              const newState = [...prev];
              newState[index] = false;
              return newState;
            });
            
            // Если это последний барабан
            if (index === delays.length - 1) {
              setIsAnimating(false);
            }
          }, delay);
          
          animationTimeoutRefs.current.push(timeout);
        });
      }, 2000);
      
      animationTimeoutRefs.current.push(stopAnimationTimeout);
    }
  }, [isSpinning, isAnimating, getRandomSymbol, reels]);
  
  // ИСПРАВЛЕНО: Обработка нового результата
  useEffect(() => {
    // Проверяем, что результат действительно новый и анимация завершена
    if (lastResult && lastResult !== lastResultRef.current && lastResult.reels && !isAnimating) {
      console.log('Получен НОВЫЙ результат с сервера:', lastResult);
      
      // Сохраняем ссылку на текущий результат
      lastResultRef.current = lastResult;
      setFinalResult({ ...lastResult });
      
      // Устанавливаем финальные символы
      setReels(lastResult.reels);
      
      // Показываем выигрышные линии если есть
      if (lastResult.winningLines && lastResult.winningLines.length > 0) {
        setTimeout(() => {
          console.log('Устанавливаем выигрышные линии');
          setWinningLines(lastResult.winningLines);
          
          // Убираем подсветку через 3 секунды
          winningTimeoutRef.current = setTimeout(() => {
            console.log('Очищаем выигрышные линии через таймаут');
            setWinningLines([]);
            winningTimeoutRef.current = null;
          }, 3000);
        }, 500);
      }
    }
  }, [lastResult, isAnimating]);
  
  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      animationTimeoutRefs.current.forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      if (winningTimeoutRef.current) {
        clearTimeout(winningTimeoutRef.current);
      }
    };
  }, []);
  
  // Функция для получения класса ячейки
  const getCellClass = useCallback((reelIndex, rowIndex) => {
    const baseClass = 'slot-cell';
    const position = `${reelIndex}-${rowIndex}`;
    
    // Показываем выигрышные только если есть актуальные линии
    if (winningLines.length > 0 && winningLines.some(line => line.includes(position))) {
      return `${baseClass} winning`;
    }
    
    return baseClass;
  }, [winningLines]);
  
  return (
    <div className="slot-machine">
      {/* Игровое поле 4x4 */}
      <div className="slot-display">
        <div className="slot-reels">
          {reels.map((reel, reelIndex) => (
            <div 
              key={reelIndex} 
              className={`slot-reel ${animatingReels[reelIndex] ? 'spinning' : ''}`}
            >
              {reel.map((symbol, rowIndex) => (
                <div
                  key={`${reelIndex}-${rowIndex}`}
                  className={getCellClass(reelIndex, rowIndex)}
                  data-position={`${reelIndex}-${rowIndex}`}
                >
                  <span className="slot-symbol">{symbol}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {/* Линии выплат для 4x4 поля */}
        <div className="paylines">
          {/* Горизонтальные линии */}
          <div className="payline horizontal line-1"></div>
          <div className="payline horizontal line-2"></div>
          <div className="payline horizontal line-3"></div>
          <div className="payline horizontal line-4"></div>
          {/* Вертикальные линии */}
          <div className="payline vertical line-5"></div>
          <div className="payline vertical line-6"></div>
          <div className="payline vertical line-7"></div>
          <div className="payline vertical line-8"></div>
          {/* Диагональные линии */}
          <div className="payline diagonal line-9"></div>
          <div className="payline diagonal line-10"></div>
        </div>
      </div>
      
      {/* Информация о последнем спине */}
      {finalResult && !isSpinning && !isAnimating && finalResult === lastResultRef.current && (
        <div className="last-spin-info">
          {finalResult.win ? (
            <div className="win-display">
              <span className="win-text">ВЫИГРЫШ!</span>
              <span className="win-amount">+{(Math.abs(finalResult.profit) || 0).toFixed(2)} USDT</span>
              {finalResult.winningSymbols && (
                <div className="winning-symbols">
                  {finalResult.winningSymbols.map((symbol, index) => (
                    <span key={index} className="winning-symbol">{symbol}</span>
                  ))}
                </div>
              )}
              {finalResult.winningLines && finalResult.winningLines.length > 0 && (
                <div className="winning-lines-count">
                  Выигрышных линий: {finalResult.winningLines.length}
                </div>
              )}
            </div>
          ) : (
            <div className="lose-display">
              <span className="lose-text">Попробуйте еще раз!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SlotMachine;
