// frontend/src/components/games/coin/CoinFlip.js
import React, { useState, useRef, useEffect } from 'react';
import '../../../styles/CoinFlip.css';

const CoinFlip = ({ flipping, result, onAnimationEnd }) => {
  const coinRef = useRef(null);
  const [showResult, setShowResult] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('idle');
  const [finalResult, setFinalResult] = useState(null);
  
  useEffect(() => {
    if (flipping && result !== null) {
      const coin = coinRef.current;
      if (!coin) return;
      
      console.log('🪙 АНИМАЦИЯ: Начинаем анимацию, результат:', result);
      
      setAnimationPhase('flipping');
      setShowResult(false);
      setFinalResult(result);
      
      // Полностью сбрасываем все классы
      coin.className = 'coin';
      
      // Небольшая задержка для сброса состояния
      setTimeout(() => {
        // Начинаем анимацию вращения
        coin.classList.add('flipping');
      }, 50);
      
      // Фаза приземления (через 2.5 секунды - когда заканчивается анимация)
      setTimeout(() => {
        setAnimationPhase('landing');
        
        // Убираем анимацию вращения
        coin.classList.remove('flipping');
        
        // Устанавливаем финальную позицию в зависимости от результата
        coin.classList.add('final-result', result);
        
        console.log('🪙 АНИМАЦИЯ: Приземление на', result);
        console.log('🪙 АНИМАЦИЯ: Классы монеты:', coin.className);
      }, 2500);
      
      // Показываем результат (через 3 секунды)
      setTimeout(() => {
        setAnimationPhase('showing');
        setShowResult(true);
        console.log('🪙 АНИМАЦИЯ: Показываем результат');
      }, 3000);
      
      // Завершаем анимацию (через 4 секунды)
      setTimeout(() => {
        setAnimationPhase('idle');
        if (onAnimationEnd) {
          onAnimationEnd();
        }
        console.log('🪙 АНИМАЦИЯ: Завершено');
      }, 4000);
      
    } else if (!flipping) {
      // Сбрасываем состояние, если не в режиме флипа
      const coin = coinRef.current;
      if (coin) {
        coin.className = 'coin';
        setShowResult(false);
        setAnimationPhase('idle');
        setFinalResult(null);
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
          {/* Сторона "Орёл" - лицевая (0 градусов) */}
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
          
          {/* Сторона "Решка" - обратная (180 градусов) */}
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
      
      {/* Результат - показываем только после завершения анимации */}
      {showResult && finalResult && (
        <div className={`coin-result ${finalResult}`}>
          <div className="result-icon">
            {finalResult === 'heads' ? '₿' : '💎'}
          </div>
          <div className="result-text">
            {finalResult === 'heads' ? 'ОРЁЛ!' : 'РЕШКА!'}
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
