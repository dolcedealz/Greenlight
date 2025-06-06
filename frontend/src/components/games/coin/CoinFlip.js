// frontend/src/components/games/coin/CoinFlip.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../styles/CoinFlip.css';

const CoinFlip = ({ flipping, result, onAnimationComplete }) => {
  const coinRef = useRef(null);
  const [currentSide, setCurrentSide] = useState('heads'); // Текущая сторона монеты
  const [animationState, setAnimationState] = useState('idle'); // idle, flipping, showing, completed
  const [localResult, setLocalResult] = useState(null);
  
  // Стабильный обработчик завершения анимации
  const handleAnimationEnd = useCallback(() => {
    console.log('🪙 АНИМАЦИЯ: Завершена полностью');
    setAnimationState('completed');
    
    // Уведомляем родителя с небольшой задержкой для плавности
    setTimeout(() => {
      if (onAnimationComplete) {
        onAnimationComplete(true); // true = показать результат игры
      }
    }, 200);
  }, [onAnimationComplete]);
  
  // ИСПРАВЛЕННАЯ логика анимации
  useEffect(() => {
    if (flipping && result !== null) {
      const coin = coinRef.current;
      if (!coin) return;
      
      console.log('🪙 АНИМАЦИЯ: Начинаем с текущей стороны:', currentSide, 'результат:', result);
      
      // Устанавливаем начальное состояние
      setAnimationState('flipping');
      setLocalResult(result);
      
      // ИСПРАВЛЕНО: Правильная настройка начального состояния
      coin.className = 'coin';
      coin.classList.add('start-position', currentSide);
      
      console.log('🪙 АНИМАЦИЯ: Подготовка к анимации...');
      
      // Небольшая задержка для стабилизации DOM
      setTimeout(() => {
        // Удаляем начальную позицию и добавляем анимацию
        coin.classList.remove('start-position');
        
        // ИСПРАВЛЕНО: Добавляем класс анимации в зависимости от текущей стороны
        coin.classList.add('flipping', currentSide);
        
        console.log(`🪙 АНИМАЦИЯ: Запущена CSS анимация с классами: flipping, ${currentSide}`);
        
        // Обновляем состояние тени
        const shadow = document.querySelector('.coin-shadow');
        if (shadow) {
          shadow.className = 'coin-shadow flipping';
        }
      }, 50);
      
      // ИСПРАВЛЕНО: Завершение анимации с правильным таймингом
      setTimeout(() => {
        // Убираем классы анимации
        coin.classList.remove('flipping', currentSide);
        
        // Устанавливаем финальный результат
        coin.classList.add('final-result', result);
        
        // Обновляем текущую сторону для следующего раза
        setCurrentSide(result);
        
        console.log('🪙 АНИМАЦИЯ: Установлена финальная позиция:', result);
        setAnimationState('showing');
        
        // Обновляем состояние тени
        const shadow = document.querySelector('.coin-shadow');
        if (shadow) {
          shadow.className = 'coin-shadow showing';
        }
      }, 2500); // Время CSS анимации
      
      // Показ локального результата
      setTimeout(() => {
        console.log('🪙 АНИМАЦИЯ: Показываем локальный результат');
        
        // Финальное состояние тени
        const shadow = document.querySelector('.coin-shadow');
        if (shadow) {
          shadow.className = 'coin-shadow completed';
        }
      }, 3000);
      
      // Полное завершение
      setTimeout(() => {
        handleAnimationEnd();
      }, 4000); // Общее время анимации
      
    } else if (!flipping && animationState !== 'idle') {
      // Сброс состояния
      const coin = coinRef.current;
      if (coin) {
        coin.className = 'coin';
        coin.classList.add('final-result', currentSide);
      }
      
      // Сброс тени
      const shadow = document.querySelector('.coin-shadow');
      if (shadow) {
        shadow.className = 'coin-shadow idle';
      }
      
      setAnimationState('idle');
      setLocalResult(null);
    }
  }, [flipping, result, currentSide, animationState, handleAnimationEnd]);
  
  // CSS анимация завершена - слушаем событие
  useEffect(() => {
    const coin = coinRef.current;
    if (!coin) return;
    
    const handleCSSAnimationEnd = (event) => {
      console.log('🪙 АНИМАЦИЯ: CSS анимация завершена:', event.animationName);
      
      if (event.animationName === 'coinFlipFromHeads' || event.animationName === 'coinFlipFromTails') {
        console.log('🪙 АНИМАЦИЯ: Основная анимация подбрасывания завершена');
      }
    };
    
    coin.addEventListener('animationend', handleCSSAnimationEnd);
    return () => {
      coin.removeEventListener('animationend', handleCSSAnimationEnd);
    };
  }, []);

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
      
      {/* Локальный результат анимации */}
      {animationState === 'showing' && localResult && (
        <div className={`coin-result ${localResult}`}>
          <div className="result-icon">
            {localResult === 'heads' ? '₿' : '💎'}
          </div>
          <div className="result-text">
            {localResult === 'heads' ? 'ОРЁЛ!' : 'РЕШКА!'}
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
