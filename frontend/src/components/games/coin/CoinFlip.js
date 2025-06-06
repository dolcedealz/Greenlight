// frontend/src/components/games/coin/CoinFlip.js - УЛУЧШЕННАЯ ВЕРСИЯ
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
      
      console.log('🪙 АНИМАЦИЯ: Начинаем улучшенную анимацию, результат:', result);
      
      setAnimationPhase('preparing');
      setShowResult(false);
      setFinalResult(result);
      
      // Полностью сбрасываем все классы
      coin.className = 'coin';
      
      // НОВОЕ: Небольшая задержка для подготовки анимации (улучшает плавность)
      setTimeout(() => {
        setAnimationPhase('flipping');
        // Начинаем анимацию вращения
        coin.classList.add('flipping');
        console.log('🪙 АНИМАЦИЯ: Запущена анимация вращения');
      }, 100);
      
      // Фаза приземления (через 2.5 секунды - когда заканчивается CSS анимация)
      setTimeout(() => {
        setAnimationPhase('landing');
        
        // Убираем анимацию вращения
        coin.classList.remove('flipping');
        
        // Устанавливаем финальную позицию в зависимости от результата
        coin.classList.add('final-result', result);
        
        console.log('🪙 АНИМАЦИЯ: Приземление на', result);
      }, 2600); // Немного больше времени CSS анимации для плавности
      
      // Показываем локальный результат анимации (через 3.2 секунды)
      setTimeout(() => {
        setAnimationPhase('showing');
        setShowResult(true);
        console.log('🪙 АНИМАЦИЯ: Показываем локальный результат');
      }, 3200);
      
      // Завершаем анимацию и сообщаем родителю (через 4.2 секунды)
      setTimeout(() => {
        setAnimationPhase('completed');
        console.log('🪙 АНИМАЦИЯ: Завершена, готовимся уведомить GameScreen');
        
        // Дополнительная небольшая задержка перед уведомлением родителя
        setTimeout(() => {
          setAnimationPhase('idle');
          if (onAnimationEnd) {
            onAnimationEnd();
          }
          console.log('🪙 АНИМАЦИЯ: Полностью завершена, уведомляем GameScreen');
        }, 300);
      }, 4200); // Оптимизированное время
      
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
      
      {/* Статус анимации - УЛУЧШЕННЫЕ СОСТОЯНИЯ */}
      {(animationPhase === 'preparing' || animationPhase === 'flipping') && (
        <div className="flip-status">
          <div className="flip-text">
            {animationPhase === 'preparing' ? 'Подготовка...' : 'Подбрасываем монету...'}
          </div>
          <div className="flip-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
      
      {/* Локальный результат анимации - показываем только после landing */}
      {showResult && finalResult && animationPhase === 'showing' && (
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
