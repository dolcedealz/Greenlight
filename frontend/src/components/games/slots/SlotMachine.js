// frontend/src/components/games/slots/SlotMachine.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../../styles/SlotMachine.css';

// ОБНОВЛЕННЫЕ символы слотов с PNG изображениями
const SLOT_SYMBOLS = [
  { symbol: 'cherry', name: 'cherry', weight: 25, payout: 4, img: '/assets/images/slots/cherry final png.png' },
  { symbol: 'lemon', name: 'lemon', weight: 20, payout: 6, img: '/assets/images/slots/lemon final png.png' },
  { symbol: 'persik', name: 'persik', weight: 15, payout: 8, img: '/assets/images/slots/persik final png.png' },
  { symbol: 'grape', name: 'grape', weight: 12, payout: 12, img: '/assets/images/slots/grape final png.png' },
  { symbol: 'bell', name: 'bell', weight: 8, payout: 18, img: '/assets/images/slots/bell final png.png' },
  { symbol: 'diamond', name: 'diamond', weight: 5, payout: 30, img: '/assets/images/slots/diamond final png.png' },
  { symbol: 'star', name: 'star', weight: 3, payout: 50, img: '/assets/images/slots/star final png.png' },
  { symbol: 'jackpot', name: 'jackpot', weight: 2, payout: 100, img: '/assets/images/slots/jackpot final png.png' }
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
  // Состояние барабанов - начинаем с символов по умолчанию
  const [reels, setReels] = useState(() => {
    return [
      ['cherry', 'lemon', 'persik', 'grape'],
      ['cherry', 'lemon', 'persik', 'grape'],
      ['cherry', 'lemon', 'persik', 'grape'],
      ['cherry', 'lemon', 'persik', 'grape']
    ];
  });
  
  // Состояния для анимации
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingReels, setAnimatingReels] = useState([false, false, false, false]);
  const [winningLines, setWinningLines] = useState([]);
  const [showingResult, setShowingResult] = useState(false);
  
  // Рефы для управления
  const lastResultRef = useRef(null);
  const animationTimeoutRefs = useRef([]);
  const winningTimeoutRef = useRef(null);
  const resultProcessedRef = useRef(false);
  
  // Функция для получения данных символа по его названию
  const getSymbolData = useCallback((symbolName) => {
    return SLOT_SYMBOLS.find(s => s.symbol === symbolName) || SLOT_SYMBOLS[0];
  }, []);
  
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
  
  // Очистка и запуск анимации при начале спина
  useEffect(() => {
    if (isSpinning && !isAnimating) {
      console.log('СЛОТЫ ФРОНТ: Спин начался - запускаем анимацию');
      
      // Сбрасываем флаг обработки результата
      resultProcessedRef.current = false;
      
      // Очищаем предыдущие таймауты
      animationTimeoutRefs.current.forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      animationTimeoutRefs.current = [];
      
      if (winningTimeoutRef.current) {
        clearTimeout(winningTimeoutRef.current);
        winningTimeoutRef.current = null;
      }
      
      // Очищаем состояние
      setWinningLines([]);
      setShowingResult(false);
      
      // Запускаем анимацию вращения
      setIsAnimating(true);
      setAnimatingReels([true, true, true, true]);
      
      // Интервалы для быстрой смены символов во время анимации
      const animationIntervals = [];
      
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
        }, 100); // Быстрая смена каждые 100мс
        
        animationIntervals.push(interval);
      });
      
      // Останавливаем анимацию через 2 секунды
      const stopAnimationTimeout = setTimeout(() => {
        // Очищаем интервалы
        animationIntervals.forEach(interval => clearInterval(interval));
        
        // Останавливаем барабаны поочередно
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
  }, [isSpinning, isAnimating, getRandomSymbol]);
  
  // Обработка результата с сервера
  useEffect(() => {
    if (lastResult && 
        lastResult !== lastResultRef.current && 
        lastResult.reels && 
        !isAnimating && 
        !isSpinning &&
        !resultProcessedRef.current) {
      
      console.log('СЛОТЫ ФРОНТ: Обрабатываем НОВЫЙ результат с сервера:', lastResult);
      
      // Помечаем результат как обработанный
      resultProcessedRef.current = true;
      lastResultRef.current = lastResult;
      
      // КРИТИЧНО: Устанавливаем ТОЧНО ТЕ ЖЕ барабаны, что пришли с сервера
      console.log('СЛОТЫ ФРОНТ: Устанавливаем барабаны с сервера:', lastResult.reels);
      setReels([...lastResult.reels]); // Создаем новый массив
      
      // Показываем результат
      setShowingResult(true);
      
      // Если есть выигрышные линии, показываем их с задержкой
      if (lastResult.winningLines && lastResult.winningLines.length > 0) {
        console.log('СЛОТЫ ФРОНТ: Показываем выигрышные линии:', lastResult.winningLines);
        
        setTimeout(() => {
          setWinningLines([...lastResult.winningLines]);
          
          // Убираем подсветку через 3 секунды
          winningTimeoutRef.current = setTimeout(() => {
            console.log('СЛОТЫ ФРОНТ: Убираем выигрышные линии');
            setWinningLines([]);
            winningTimeoutRef.current = null;
          }, 3000);
        }, 500);
      } else {
        console.log('СЛОТЫ ФРОНТ: Выигрышных линий нет');
      }
    }
  }, [lastResult, isAnimating, isSpinning]);
  
  // Очистка при размонтировании
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
  
  // Функция для определения класса ячейки
  const getCellClass = useCallback((reelIndex, rowIndex) => {
    const baseClass = 'slot-cell';
    const position = `${reelIndex}-${rowIndex}`;
    
    // Показываем выигрышные только если есть активные линии
    if (winningLines.length > 0) {
      const isWinning = winningLines.some(line => line.includes(position));
      if (isWinning) {
        return `${baseClass} winning`;
      }
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
              {reel.map((symbolName, rowIndex) => {
                const symbolData = getSymbolData(symbolName);
                return (
                  <div
                    key={`${reelIndex}-${rowIndex}`}
                    className={getCellClass(reelIndex, rowIndex)}
                    data-position={`${reelIndex}-${rowIndex}`}
                  >
                    <img 
                      src={symbolData.img} 
                      alt={symbolData.name}
                      className="slot-symbol-img"
                      onError={(e) => {
                        // Fallback на эмодзи если изображение не загрузилось
                        const fallbackEmojis = {
                          'cherry': '🍒',
                          'lemon': '🍋',
                          'persik': '🍑',
                          'grape': '🍇',
                          'bell': '🔔',
                          'diamond': '💎',
                          'star': '⭐',
                          'jackpot': '🎰'
                        };
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<span class="slot-symbol">${fallbackEmojis[symbolName] || '🍒'}</span>`;
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        
        {/* Линии выплат для 4x4 поля - ТОЛЬКО горизонтальные и диагональные */}
        <div className="paylines">
          {/* Горизонтальные линии - ОСТАВЛЯЕМ */}
          <div className="payline horizontal line-1"></div>
          <div className="payline horizontal line-2"></div>
          <div className="payline horizontal line-3"></div>
          <div className="payline horizontal line-4"></div>
          
          {/* Диагональные линии - ОСТАВЛЯЕМ */}
          <div className="payline diagonal line-9"></div>
          <div className="payline diagonal line-10"></div>
        </div>
      </div>
      
      {/* Информация о результате */}
      {showingResult && lastResult && lastResultRef.current === lastResult && !isSpinning && !isAnimating && (
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
                      <img 
                        key={index} 
                        src={symbolData.img} 
                        alt={symbolData.name}
                        className="winning-symbol-img"
                        onError={(e) => {
                          const fallbackEmojis = {
                            'cherry': '🍒',
                            'lemon': '🍋',
                            'persik': '🍑',
                            'grape': '🍇',
                            'bell': '🔔',
                            'diamond': '💎',
                            'star': '⭐',
                            'jackpot': '🎰'
                          };
                          e.target.outerHTML = `<span class="winning-symbol">${fallbackEmojis[symbolName] || '🍒'}</span>`;
                        }}
                      />
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
