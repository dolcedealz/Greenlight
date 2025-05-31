// frontend/src/components/games/coin/CoinFlip.js
import React, { useState, useRef, useEffect } from 'react';
import '../../../styles/CoinFlip.css';

const CoinFlip = ({ flipping, result, onAnimationEnd }) => {
  const coinRef = useRef(null);
  const [showResult, setShowResult] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('idle'); // 'idle', 'flipping', 'landing', 'showing'
  
  useEffect(() => {
    if (flipping && result !== null) {
      const coin = coinRef.current;
      if (!coin) return;
      
      setAnimationPhase('flipping');
      setShowResult(false);
      
      // Добавляем класс анимации
      coin.classList.add('flipping');
      coin.classList.remove('heads', 'tails');
      
      // Фаза приземления (через 2 секунды)
      setTimeout(() => {
        setAnimationPhase('landing');
        coin.classList.remove('flipping');
        coin.classList.add(result === 'heads' ? 'heads' : 'tails');
      }, 2000);
      
      // Показываем результат (через 2.5 секунды)
      setTimeout(() => {
        setAnimationPhase('showing');
        setShowResult(true);
      }, 2500);
      
      // Вызываем callback после завершения анимации (через 3 секунды)
      setTimeout(() => {
        setAnimationPhase('idle');
        if (onAnimationEnd) {
          onAnimationEnd();
        }
      }, 3000);
      
    } else if (!flipping) {
      // Сбрасываем состояние, если не в режиме флипа
      const coin = coinRef.current;
      if (coin) {
        coin.classList.remove('flipping', 'heads', 'tails');
        setShowResult(false);
        setAnimationPhase('idle');
      }
    }
  }, [flipping, result, onAnimationEnd]);

  return (
    <div className="coin-flip-container">
      {/* Декоративные элементы */}
      <div className="coin-atmosphere">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
      </div>
      
      {/* Тень монеты */}
      <div className={`coin-shadow ${animationPhase}`}></div>
      
      {/* Основная монета */}
      <div className="coin-wrapper">
        <div className="coin" ref={coinRef}>
          {/* Сторона "Орёл" */}
          <div className="coin-side heads">
            <div className="coin-face">
              <div className="coin-inner-ring">
                <div className="coin-center">
                  <span className="coin-symbol">₿</span>
                  <div className="coin-text">HEADS</div>
                </div>
              </div>
              <div className="coin-sparkles">
                <div className="sparkle sparkle-1"></div>
                <div className="sparkle sparkle-2"></div>
                <div className="sparkle sparkle-3"></div>
              </div>
            </div>
          </div>
          
          {/* Сторона "Решка" */}
          <div className="coin-side tails">
            <div className="coin-face">
              <div className="coin-inner-ring">
                <div className="coin-center">
                  <span className="coin-symbol">💎</span>
                  <div className="coin-text">TAILS</div>
                </div>
              </div>
              <div className="coin-sparkles">
                <div className="sparkle sparkle-1"></div>
                <div className="sparkle sparkle-2"></div>
                <div className="sparkle sparkle-3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Статус анимации */}
      {animationPhase === 'flipping' && (
        <div className="flip-status">
          <div className="flip-text">Подбрасываем монету...</div>
          <div className="flip-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
      
      {/* Результат */}
      {showResult && result && (
        <div className={`coin-result ${result}`}>
          <div className="result-icon">
            {result === 'heads' ? '₿' : '💎'}
          </div>
          <div className="result-text">
            {result === 'heads' ? 'ОРЁЛ!' : 'РЕШКА!'}
          </div>
          <div className="result-celebration">
            <div className="celebration-particle"></div>
            <div className="celebration-particle"></div>
            <div className="celebration-particle"></div>
            <div className="celebration-particle"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoinFlip;
