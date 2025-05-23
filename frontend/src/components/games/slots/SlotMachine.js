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
  loading 
}) => {
  const [reels, setReels] = useState([
    ['🍒', '🍋', '🍊', '🍇', '🔔'],
    ['🍒', '🍋', '🍊', '🍇', '🔔'],
    ['🍒', '🍋', '🍊', '🍇', '🔔'],
    ['🍒', '🍋', '🍊', '🍇', '🔔'],
    ['🍒', '🍋', '🍊', '🍇', '🔔']
  ]);
  const [animatingReels, setAnimatingReels] = useState([false, false, false, false, false]);
  const [winningLines, setWinningLines] = useState([]);
  
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
  
  // Эффект для обработки результата игры
  useEffect(() => {
    if (lastResult && lastResult.reels) {
      // Останавливаем анимацию и показываем результат
      setAnimatingReels([false, false, false, false, false]);
      setReels(lastResult.reels);
      setWinningLines(lastResult.winningLines || []);
      
      // Если есть выигрыш, подсвечиваем выигрышные линии
      if (lastResult.winningLines && lastResult.winningLines.length > 0) {
        setTimeout(() => {
          setWinningLines([]);
        }, 3000);
      }
    }
  }, [lastResult]);
  
  // Эффект для анимации вращения
  useEffect(() => {
    if (isSpinning) {
      setWinningLines([]);
      
      // Запускаем анимацию для каждого барабана с задержкой
      const delays = [0, 200, 400, 600, 800];
      
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
                getRandomSymbol(),
                getRandomSymbol()
              ];
              return newReels;
            });
          }, 100);
          
          // Останавливаем анимацию через 2 секунды + задержка
          setTimeout(() => {
            clearInterval(interval);
            setAnimatingReels(prev => {
              const newState = [...prev];
              newState[index] = false;
              return newState;
            });
          }, 2000 + delay);
        }, delay);
      });
    }
  }, [isSpinning, getRandomSymbol]);
  
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
        
        {/* Линии выплат для 5x5 поля */}
        <div className="paylines">
          {/* Горизонтальные линии */}
          <div className="payline horizontal line-1"></div>
          <div className="payline horizontal line-2"></div>
          <div className="payline horizontal line-3"></div>
          <div className="payline horizontal line-4"></div>
          <div className="payline horizontal line-5"></div>
          {/* Диагональные линии */}
          <div className="payline diagonal line-6"></div>
          <div className="payline diagonal line-7"></div>
        </div>
      </div>
      
      {/* Таблица выплат */}
      <div className="payout-table">
        <h4>Таблица выплат (коэффициент от ставки)</h4>
        <div className="payout-grid">
          {SLOT_SYMBOLS.map((symbolData, index) => (
            <div key={index} className="payout-item">
              <span className="payout-symbol">{symbolData.symbol}</span>
              <span className="payout-multiplier">×{symbolData.payout}</span>
            </div>
          ))}
        </div>
        <div className="payout-note">
          * Выигрыш при 5 одинаковых символах в линию
        </div>
      </div>
      
      {/* Информация о последнем спине */}
      {lastResult && (
        <div className="last-spin-info">
          {lastResult.win ? (
            <div className="win-display">
              <span className="win-text">ВЫИГРЫШ!</span>
              <span className="win-amount">+{lastResult.winAmount?.toFixed(2)} USDT</span>
              {lastResult.winningSymbols && (
                <div className="winning-symbols">
                  {lastResult.winningSymbols.map((symbol, index) => (
                    <span key={index} className="winning-symbol">{symbol}</span>
                  ))}
                </div>
              )}
              {lastResult.winningLines && lastResult.winningLines.length > 0 && (
                <div className="winning-lines-count">
                  Выигрышных линий: {lastResult.winningLines.length}
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
