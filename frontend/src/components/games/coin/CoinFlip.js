// frontend/src/components/games/coin/CoinFlip.js - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ДВОЙНОЙ АНИМАЦИИ
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../styles/CoinFlip.css';

const CoinFlip = ({ flipping, result, onAnimationComplete }) => {
  const coinRef = useRef(null);
  const [currentSide, setCurrentSide] = useState('heads');
  const [animationState, setAnimationState] = useState('idle');
  const [isAnimating, setIsAnimating] = useState(false); // Флаг для предотвращения двойного запуска
  
  // Стабильный обработчик завершения анимации
  const handleAnimationEnd = useCallback(() => {
    console.log('🪙 АНИМАЦИЯ: Завершена полностью');
    setAnimationState('completed');
    setIsAnimating(false);
    
    // Уведомляем родителя о завершении
    if (onAnimationComplete) {
      onAnimationComplete(true);
    }
  }, [onAnimationComplete]);
  
  // ИСПРАВЛЕННАЯ логика анимации - предотвращаем двойной запуск
  useEffect(() => {
    // Предотвращаем повторный запуск если анимация уже идет
    if (isAnimating) {
      console.log('🪙 АНИМАЦИЯ: Уже запущена, пропускаем');
      return;
    }
    
    if (flipping && result !== null) {
      console.log('🪙 АНИМАЦИЯ: НАЧИНАЕМ НОВУЮ анимацию, результат:', result);
      
      const coin = coinRef.current;
      if (!coin) return;
      
      // Устанавливаем флаг анимации
      setIsAnimating(true);
      setAnimationState('flipping');
      
      // Сбрасываем все классы
      coin.className = 'coin';
      coin.classList.add('start-position', currentSide);
      
      // Запускаем анимацию
      setTimeout(() => {
        coin.classList.remove('start-position');
        coin.classList.add('flipping', currentSide);
        
        console.log(`🪙 АНИМАЦИЯ: CSS анимация запущена с классами: flipping, ${currentSide}`);
        
        // Обновляем тень
        const shadow = document.querySelector('.coin-shadow');
        if (shadow) {
          shadow.className = 'coin-shadow flipping';
        }
      }, 50);
      
      // СИНХРОНИЗИРОВАННОЕ завершение - сокращаем время до 2000ms
      setTimeout(() => {
        // Убираем анимацию и устанавливаем финальный результат
        coin.classList.remove('flipping', currentSide);
        coin.classList.add('final-result', result);
        
        setCurrentSide(result);
        setAnimationState('showing');
        
        console.log('🪙 АНИМАЦИЯ: Установлен финальный результат:', result);
        
        // Обновляем тень
        const shadow = document.querySelector('.coin-shadow');
        if (shadow) {
          shadow.className = 'coin-shadow completed';
        }
        
        // Завершаем анимацию и уведомляем родителя сразу
        setTimeout(() => {
          handleAnimationEnd();
        }, 300); // Короткая задержка для плавности
        
      }, 1800); // Синхронизируем с CSS анимацией (1.5s + небольшой буфер)
      
    } else if (!flipping && animationState !== 'idle') {
      // Сброс состояния
      console.log('🪙 АНИМАЦИЯ: Сброс состояния');
      const coin = coinRef.current;
      if (coin) {
        coin.className = 'coin';
        coin.classList.add('final-result', currentSide);
      }
      
      const shadow = document.querySelector('.coin-shadow');
      if (shadow) {
        shadow.className = 'coin-shadow idle';
      }
      
      setAnimationState('idle');
      setIsAnimating(false);
    }
  }, [flipping, result]); // Убираем лишние dependencies
  
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
      <div className={`coin-shadow ${animationState}`}></div>
      
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
      
      {/* Статус анимации - показываем только во время подбрасывания */}
      {animationState === 'flipping' && (
        <div className="flip-status">
          <div className="flip-text">Подбрасываем монету...</div>
          <div className="flip-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoinFlip;
