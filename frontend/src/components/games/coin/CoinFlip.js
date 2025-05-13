// CoinFlip.js
import React, { useState, useRef, useEffect } from 'react';
import '../../../styles/CoinFlip.css';

// Компонент для анимации монеты
const CoinFlip = ({ flipping, result, onAnimationEnd }) => {
  const coinRef = useRef(null);
  
  useEffect(() => {
    // Если начался флип и у нас есть результат
    if (flipping && result !== null) {
      const coin = coinRef.current;
      
      // Добавляем класс анимации
      coin.classList.add('flipping');
      
      // Устанавливаем конечный класс в зависимости от результата
      setTimeout(() => {
        coin.classList.remove('flipping');
        coin.classList.add(result === 'heads' ? 'heads' : 'tails');
        
        // Вызываем callback после завершения анимации
        setTimeout(() => {
          onAnimationEnd && onAnimationEnd();
        }, 500);
      }, 1500); // Длительность анимации вращения
    } else if (!flipping) {
      // Сбрасываем классы, если не в режиме флипа
      const coin = coinRef.current;
      coin.classList.remove('flipping', 'heads', 'tails');
    }
  }, [flipping, result, onAnimationEnd]);

  return (
    <div className="coin-container">
      <div className="coin" ref={coinRef}>
        <div className="coin-side heads">
          <span>O</span>
        </div>
        <div className="coin-side tails">
          <span>P</span>
        </div>
      </div>
    </div>
  );
};

export default CoinFlip;