// frontend/src/components/games/slots/SlotMachine.js
import React, { useState, useEffect, useCallback } from 'react';
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
  // ОБНОВЛЕНО: состояние барабанов сохраняется между играми
  const [reels, setReels] = useState(() => {
    // Инициализация случайными символами
    return [
      ['🍒', '🍋', '🍊', '🍇'],
      ['🍒', '🍋', '🍊', '🍇'],
      ['🍒', '🍋', '🍊', '🍇'],
      ['🍒', '🍋', '🍊', '🍇']
    ];
  });
  
  const [animatingReels, setAnimatingReels] = useState([false, false, false, false]);
  const [winningLines, setWinningLines] = useState([]);
  const [finalResult, setFinalResult] = useState(null); // НОВОЕ: хранит финальный результат
  
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
  
  // ИСПРАВЛЕНО: результат устанавливается сразу и не меняется
  useEffect(() => {
    if (lastResult && lastResult.reels) {
      console.log('Получен результат с сервера:', lastResult.reels);
      
      // Сохраняем финальный результат
      setFinalResult(lastResult);
      
      // НЕ устанавливаем результат сразу, ждем окончания анимации
      setWinningLines([]);
    }
  }, [lastResult]);
  
  // ИСПРАВЛЕНО: анимация с правильной установкой результата
  useEffect(() => {
    if (isSpinning && finalResult) {
      setWinningLines([]);
      
      // Запускаем анимацию для каждого барабана с задержкой
      const delays = [0, 200, 400, 600];
      
      delays.forEach((delay, index) => {
        setTimeout(() => {
          setAnimatingReels(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
          
          // Показываем анимационные символы
          const interval = setInterval(() => {
            setReels(prev => {
              const newReels = [...prev];
              newReels[index] = [
                getRandomSymbol(),
                getRandomSymbol(),
                getRandomSymbol(),
                getRandomSymbol()
              ];
              return newReels;
            });
          }, 100);
          
          // Останавливаем анимацию через 2 секунды + задержка
          setTimeout(() => {
            clearInterval(interval);
            
            // ИСПРАВЛЕНО: устанавливаем ФИНАЛЬНЫЙ результат с сервера
            setReels(prev => {
              const newReels = [...prev];
              newReels[index] = finalResult.reels[index];
              return newReels;
            });
            
            setAnimatingReels(prev => {
              const newState = [...prev];
              newState[index] = false;
              return newState;
            });
            
            // Если это последний барабан, показываем выигрышные линии
            if (index === delays.length - 1) {
              setTimeout(() => {
                if (finalResult.winningLines && finalResult.winningLines.length > 0) {
                  setWinningLines(finalResult.winningLines);
                  
                  // Убираем подсветку через 3 секунды
                  setTimeout(() => {
                    setWinningLines([]);
                  }, 3000);
                }
              }, 300);
            }
          }, 2000 + delay);
        }, delay);
      });
    }
  }, [isSpinning, finalResult, getRandomSymbol]);
  
  // НОВЫЙ ЭФФЕКТ: очистка состояния при новой игре
  useEffect(() => {
    if (isSpinning && !finalResult) {
      // Новая игра началась, но результат еще не получен
      setWinningLines([]);
    }
  }, [isSpinning, finalResult]);
  
  // Функция для получения класса ячейки
  const getCellClass = useCallback((reelIndex, rowIndex) => {
    const baseClass = 'slot-cell';
    const position = `${reelIndex}-${rowIndex}`;
    
    if (winningLines.some(line => line.includes(position))) {
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
      {finalResult && !isSpinning && (
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
