// frontend/src/components/games/coin/CoinFlip.js
import React, { useState, useRef, useEffect } from 'react';
import '../../../styles/CoinFlip.css';

const CoinFlip = ({ flipping, result, onAnimationEnd }) => {
  const coinRef = useRef(null);
  const [showResult, setShowResult] = useState(false);
  
  useEffect(() => {
    if (flipping && result !== null) {
      const coin = coinRef.current;
      if (!coin) return;
      
      // Добавляем класс анимации
      coin.classList.add('flipping');
      setShowResult(false);
      
      // Устанавливаем конечный класс в зависимости от результата
      setTimeout(() => {
        coin.classList.remove('flipping');
        coin.classList.add(result === 'heads' ? 'heads' : 'tails');
        setShowResult(true);
        
        // Вызываем callback после завершения анимации
        setTimeout(() => {
          if (onAnimationEnd) {
            onAnimationEnd();
          }
        }, 800);
      }, 1500); // Длительность анимации вращения
    } else if (!flipping) {
      // Сбрасываем классы, если не в режиме флипа
      const coin = coinRef.current;
      if (coin) {
        coin.classList.remove('flipping', 'heads', 'tails');
        setShowResult(false);
      }
    }
  }, [flipping, result, onAnimationEnd]);

  return (
    <div className="coin-container">
      <div className="coin-shadow"></div>
      <div className="coin" ref={coinRef}>
        <div className="coin-side heads">
          <span>O</span>
        </div>
        <div className="coin-side tails">
          <span>P</span>
        </div>
      </div>
      
      {showResult && (
        <div className={`coin-result ${result === 'heads' ? 'heads' : 'tails'}`}>
          {result === 'heads' ? 'ОРЁЛ' : 'РЕШКА'}
        </div>
      )}
    </div>
  );
};

export default CoinFlip;
