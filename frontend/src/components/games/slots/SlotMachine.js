// frontend/src/components/games/slots/SlotMachine.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../../styles/SlotMachine.css';

// Упрощенные символы слотов с fallback на эмодзи
const SLOT_SYMBOLS = [
  { symbol: 'cherry', name: 'cherry', weight: 25, payout: 4, emoji: '🍒', img: '/assets/images/slots/cherry.png' },
  { symbol: 'lemon', name: 'lemon', weight: 20, payout: 6, emoji: '🍋', img: '/assets/images/slots/lemon.png' },
  { symbol: 'persik', name: 'persik', weight: 15, payout: 8, emoji: '🍑', img: '/assets/images/slots/persik.png' },
  { symbol: 'grape', name: 'grape', weight: 12, payout: 12, emoji: '🍇', img: '/assets/images/slots/grape.png' },
  { symbol: 'bell', name: 'bell', weight: 8, payout: 18, emoji: '🔔', img: '/assets/images/slots/bell.png' },
  { symbol: 'diamond', name: 'diamond', weight: 5, payout: 30, emoji: '💎', img: '/assets/images/slots/diamond.png' },
  { symbol: 'star', name: 'star', weight: 3, payout: 50, emoji: '⭐', img: '/assets/images/slots/star.png' },
  { symbol: 'jackpot', name: 'jackpot', weight: 2, payout: 100, emoji: '🎰', img: '/assets/images/slots/jackpot.png' }
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
  
  // Рефы
  const animationIntervals = useRef([]);
  const animationTimeouts = useRef([]);
  const lastResultRef = useRef(null);
  
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
    animationIntervals.current.forEach(interval => {
      if (interval) clearInterval(interval);
    });
    animationIntervals.current = [];
    
    animationTimeouts.current.forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    animationTimeouts.current = [];
  }, []);
  
  // Запуск анимации при начале спина
  useEffect(() => {
    if (isSpinning && !isAnimating) {
      console.log('СЛОТЫ: Запуск анимации');
      
      // Очищаем предыдущие анимации
      clearAnimations();
      
      // Сбрасываем состояния
      setWinningLines([]);
      setShowingResult(false);
      setIsAnimating(true);
      setAnimatingReels([true, true, true, true]);
      
      // Запускаем анимацию быстрой смены символов
      const intervals = [];
      
      for (let reelIndex = 0; reelIndex < 4; reelIndex++) {
        const interval = setInterval(() => {
          setReels(prevReels => {
            const newReels = [...prevReels];
            newReels[reelIndex] = Array(4).fill().map(() => getRandomSymbol());
            return newReels;
          });
        }, 80); // Быстрая смена каждые 80мс
        
        intervals.push(interval);
      }
      
      animationIntervals.current = intervals;
      
      // Останавливаем барабаны поочередно
      const stopDelays = [1500, 1700, 1900, 2100]; // Задержки для каждого барабана
      
      stopDelays.forEach((delay, index) => {
        const timeout = setTimeout(() => {
          // Останавливаем интервал для этого барабана
          if (animationIntervals.current[index]) {
            clearInterval(animationIntervals.current[index]);
            animationIntervals.current[index] = null;
          }
          
          // Отключаем анимацию для барабана
          setAnimatingReels(prev => {
            const newState = [...prev];
            newState[index] = false;
            return newState;
          });
          
          // Если это последний барабан
          if (index === 3) {
            setIsAnimating(false);
          }
        }, delay);
        
        animationTimeouts.current.push(timeout);
      });
    }
  }, [isSpinning, isAnimating, getRandomSymbol, clearAnimations]);
  
  // Обработка результата с сервера
  useEffect(() => {
    if (lastResult && 
        lastResult !== lastResultRef.current && 
        lastResult.reels && 
        !isAnimating && 
        !isSpinning) {
      
      console.log('СЛОТЫ: Устанавливаем результат с сервера:', lastResult);
      
      lastResultRef.current = lastResult;
      
      // Устанавливаем барабаны из результата
      setReels([...lastResult.reels]);
      setShowingResult(true);
      
      // Показываем выигрышные линии
      if (lastResult.winningLines && lastResult.winningLines.length > 0) {
        setTimeout(() => {
          setWinningLines([...lastResult.winningLines]);
          
          // Убираем подсветку через 3 секунды
          setTimeout(() => {
            setWinningLines([]);
          }, 3000);
        }, 500);
      }
    }
  }, [lastResult, isAnimating, isSpinning]);
  
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
  
  // Компонент символа с fallback
  const SymbolComponent = React.memo(({ symbolName, className }) => {
    const symbolData = getSymbolData(symbolName);
    const [imageError, setImageError] = useState(false);
    
    const handleImageError = () => {
      setImageError(true);
    };
    
    if (imageError) {
      return <span className="slot-symbol">{symbolData.emoji}</span>;
    }
    
    return (
      <img 
        src={symbolData.img} 
        alt={symbolData.name}
        className={className}
        onError={handleImageError}
      />
    );
  });
  
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
              {reel.map((symbolName, rowIndex) => (
                <div
                  key={`${reelIndex}-${rowIndex}`}
                  className={getCellClass(reelIndex, rowIndex)}
                  data-position={`${reelIndex}-${rowIndex}`}
                >
                  <SymbolComponent 
                    symbolName={symbolName}
                    className="slot-symbol-img"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {/* Линии выплат */}
        <div className="paylines">
          <div className={`payline horizontal line-1 ${winningLines.some(line => line.includes('0-0') && line.includes('1-0')) ? 'active' : ''}`}></div>
          <div className={`payline horizontal line-2 ${winningLines.some(line => line.includes('0-1') && line.includes('1-1')) ? 'active' : ''}`}></div>
          <div className={`payline horizontal line-3 ${winningLines.some(line => line.includes('0-2') && line.includes('1-2')) ? 'active' : ''}`}></div>
          <div className={`payline horizontal line-4 ${winningLines.some(line => line.includes('0-3') && line.includes('1-3')) ? 'active' : ''}`}></div>
          <div className={`payline diagonal line-9 ${winningLines.some(line => line.includes('0-0') && line.includes('1-1') && line.includes('2-2')) ? 'active' : ''}`}></div>
          <div className={`payline diagonal line-10 ${winningLines.some(line => line.includes('0-3') && line.includes('1-2') && line.includes('2-1')) ? 'active' : ''}`}></div>
        </div>
      </div>
      
      {/* Информация о результате */}
      {showingResult && lastResult && !isSpinning && !isAnimating && (
        <div className="last-spin-info">
          {lastResult.win ? (
            <div className="win-display">
              <span className="win-text">ВЫИГРЫШ!</span>
              <span className="win-amount">+{(Math.abs(lastResult.profit) || 0).toFixed(2)} USDT</span>
              {lastResult.winningSymbols && lastResult.winningSymbols.length > 0 && (
                <div className="winning-symbols">
                  {lastResult.winningSymbols.map((symbolName, index) => {
                    const symbolData = getSymbolData(symbolName);
                    return (
                      <span key={index} className="winning-symbol">
                        {symbolData.emoji}
                      </span>
                    );
                  })}
                </div>
              )}
              {lastResult.winningLines && lastResult.winningLines.length > 0 && (
                <div className="winning-lines-count">
                  Выигрышных линий: {lastResult.winningLines.length} | Множитель: x{(lastResult.multiplier || 0).toFixed(2)}
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
