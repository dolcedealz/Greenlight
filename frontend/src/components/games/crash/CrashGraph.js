// frontend/src/components/games/crash/CrashGraph.js
import React, { useRef, useEffect, useState } from 'react';
import '../../../styles/CrashGraph.css';

const CrashGraph = ({ multiplier, gameState, crashPoint, timeToStart, roundId }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const pathPointsRef = useRef([]);
  const particlesRef = useRef([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const lastRoundIdRef = useRef(roundId);
  const gameStartTimeRef = useRef(null);
  const isAnimatingRef = useRef(false);
  
  // Обновление размеров canvas
  useEffect(() => {
    const updateSize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        setCanvasSize({
          width: Math.max(rect.width, 400),
          height: Math.max(rect.height, 300)
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Сброс данных при новом раунде
  useEffect(() => {
    if (roundId !== lastRoundIdRef.current && roundId > 0) {
      console.log('ГРАФИК: Новый раунд', roundId);
      pathPointsRef.current = [];
      particlesRef.current = [];
      gameStartTimeRef.current = null;
      lastRoundIdRef.current = roundId;
    }
  }, [roundId]);
  
  // Управление анимацией
  useEffect(() => {
    if (gameState === 'flying' && gameStartTimeRef.current === null) {
      gameStartTimeRef.current = Date.now();
      isAnimatingRef.current = true;
      console.log('ГРАФИК: Полет начался');
      
      // ИСПРАВЛЕНИЕ: При входе в активную игру пересоздаем траекторию
      if (multiplier > 1.0) {
        console.log('ГРАФИК: Восстанавливаем траекторию для активной игры, множитель:', multiplier);
        rebuildTrajectoryForActiveGame();
      }
    } else if (gameState !== 'flying') {
      isAnimatingRef.current = false;
    }
  }, [gameState, multiplier]);
  
  // НОВАЯ ФУНКЦИЯ: Восстановление траектории для активной игры
  const rebuildTrajectoryForActiveGame = () => {
    if (!gameStartTimeRef.current) return;
    
    const padding = 50;
    const width = canvasSize.width - padding * 2;
    const height = canvasSize.height - padding * 2;
    
    // Очищаем старую траекторию
    pathPointsRef.current = [];
    
    // Вычисляем примерное время игры на основе текущего множителя
    const estimatedTimeElapsed = Math.log(multiplier) / 0.06;
    
    // Создаем точки траектории от начала до текущего момента
    const pointsCount = Math.min(100, Math.max(10, Math.floor(estimatedTimeElapsed * 3)));
    
    for (let i = 0; i <= pointsCount; i++) {
      const timeStep = (estimatedTimeElapsed * i) / pointsCount;
      const stepMultiplier = 1 + timeStep * 0.06;
      
      // ИСПРАВЛЕННАЯ формула X координаты - более медленный рост
      const x = calculateXCoordinate(timeStep, padding, width);
      
      // ИСПРАВЛЕННАЯ формула Y координаты - плавная кривая
      const y = calculateYCoordinate(stepMultiplier, padding, height);
      
      pathPointsRef.current.push({ 
        x, 
        y, 
        multiplier: stepMultiplier, 
        time: gameStartTimeRef.current + (timeStep * 1000) 
      });
    }
    
    console.log('ГРАФИК: Восстановлена траектория с', pathPointsRef.current.length, 'точками');
  };
  
  // НОВАЯ ФУНКЦИЯ: Расчет X координаты с плавной кривой
  const calculateXCoordinate = (timeElapsed, padding, width) => {
    // Используем логарифмическую функцию для более плавного роста X
    const maxTime = 20; // Максимальное время до достижения правого края
    const normalizedTime = Math.min(timeElapsed / maxTime, 1);
    
    // Плавная кривая для X - быстрее в начале, медленнее к концу
    const curveX = 1 - Math.pow(1 - normalizedTime, 1.5);
    
    return padding + curveX * width * 0.85;
  };
  
  // ИСПРАВЛЕННАЯ ФУНКЦИЯ: Расчет Y координаты с плавной кривой
  const calculateYCoordinate = (currentMultiplier, padding, height) => {
    const multiplierForY = Math.max(currentMultiplier, 1.0);
    
    // ИСПРАВЛЕННАЯ формула: очень плавная S-образная кривая
    const normalizedMultiplier = (multiplierForY - 1) / 9; // Нормализуем от 0 до 1 для диапазона 1x-10x
    
    // Используем комбинацию функций для создания плавной кривой снизу вверх
    let curveValue;
    
    if (normalizedMultiplier < 0.5) {
      // В начале - медленный подъем (квадратичная функция)
      curveValue = 2 * normalizedMultiplier * normalizedMultiplier;
    } else {
      // Во второй половине - более быстрый подъем
      const t = normalizedMultiplier - 0.5;
      curveValue = 0.5 + 2 * t * (1 - t/2);
    }
    
    // Ограничиваем максимальную высоту
    curveValue = Math.min(curveValue, 0.9);
    
    return padding + height * (1 - curveValue);
  };
  
  // Класс для частиц
  class Particle {
    constructor(x, y, type = 'trail') {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 4;
      this.vy = (Math.random() - 0.5) * 4;
      this.life = 1.0;
      this.decay = 0.02 + Math.random() * 0.03;
      this.size = 2 + Math.random() * 4;
      this.type = type;
      this.color = type === 'explosion' ? '#ff3b30' : '#0ba84a';
    }
    
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      this.size *= 0.99;
      
      if (this.type === 'trail') {
        this.vy += 0.1; // Гравитация
      }
      
      return this.life > 0;
    }
    
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  
  // Основная функция рисования
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    const draw = () => {
      // Очищаем canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Градиентный фон
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#0a0a0a');
      bgGradient.addColorStop(0.5, '#151515');
      bgGradient.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Рисуем в зависимости от состояния
      switch (gameState) {
        case 'waiting':
          drawWaitingState(ctx);
          break;
        case 'flying':
          drawGrid(ctx);
          drawFlyingState(ctx);
          break;
        case 'crashed':
          drawGrid(ctx);
          drawCrashedState(ctx);
          break;
        default:
          drawLoadingState(ctx);
      }
    };
    
    // ИСПРАВЛЕННАЯ сетка графика - увеличена до 10x
    const drawGrid = (ctx) => {
      const padding = 50;
      const width = canvas.width - padding * 2;
      const height = canvas.height - padding * 2;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Горизонтальные линии (множители) - ИСПРАВЛЕНО: увеличено до 10x
      for (let i = 0; i <= 10; i++) {
        const y = padding + (i * height / 10);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
        
        // Подписи множителей - ИСПРАВЛЕНО: новая формула для 1x-10x
        if (i % 2 === 0) {
          const mult = 10 - (i * 0.9); // Диапазон от 10x до 1x
          if (mult >= 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${mult.toFixed(1)}x`, padding - 10, y + 4);
          }
        }
      }
      
      // Вертикальные линии (время) - увеличили до 20 секунд
      for (let i = 0; i <= 20; i++) {
        const x = padding + (i * width / 20);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + height);
        ctx.stroke();
        
        // Подписи времени
        if (i % 4 === 0) {
          const time = i * 1;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${time}s`, x, padding + height + 20);
        }
      }
      
      // Оси
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, padding + height);
      ctx.lineTo(padding + width, padding + height);
      ctx.stroke();
    };
    
    // Состояние ожидания
    const drawWaitingState = (ctx) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Пульсирующий круг
      const time = Date.now() / 1000;
      const pulse = Math.sin(time * 3) * 0.3 + 1;
      const radius = 80 * pulse;
      
      // Градиент для круга
      const circleGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );
      circleGradient.addColorStop(0, 'rgba(11, 168, 74, 0.8)');
      circleGradient.addColorStop(0.7, 'rgba(11, 168, 74, 0.3)');
      circleGradient.addColorStop(1, 'rgba(11, 168, 74, 0)');
      
      ctx.fillStyle = circleGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Прогресс-кольцо
      if (timeToStart > 0 && timeToStart <= 7) {
        const progress = (7 - timeToStart) / 7;
        const angle = progress * Math.PI * 2 - Math.PI / 2;
        
        ctx.strokeStyle = '#0ba84a';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 100, -Math.PI / 2, angle);
        ctx.stroke();
      }
      
      // Основной текст
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      
      ctx.fillText('СТАВКИ', centerX, centerY - 20);
      ctx.fillText('ПРИНИМАЮТСЯ', centerX, centerY + 20);
      
      // Таймер
      if (timeToStart > 0) {
        ctx.fillStyle = '#0ba84a';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(Math.ceil(timeToStart).toString(), centerX, centerY + 80);
      }
      
      ctx.shadowBlur = 0;
    };
    
    // ИСПРАВЛЕННОЕ состояние полета с плавной траекторией
    const drawFlyingState = (ctx) => {
      if (!gameStartTimeRef.current || !isAnimatingRef.current) return;
      
      const padding = 50;
      const width = canvas.width - padding * 2;
      const height = canvas.height - padding * 2;
      
      // Вычисляем позицию точки
      const timeElapsed = (Date.now() - gameStartTimeRef.current) / 1000;
      
      // ИСПРАВЛЕННАЯ формула X координаты - плавная кривая
      const x = calculateXCoordinate(timeElapsed, padding, width);
      
      // ИСПРАВЛЕННАЯ формула Y координаты - плавная кривая
      const y = calculateYCoordinate(multiplier, padding, height);
      
      // Добавляем точку в путь
      if (timeElapsed > 0) {
        pathPointsRef.current.push({ x, y, multiplier, time: Date.now() });
        
        // Ограничиваем количество точек
        if (pathPointsRef.current.length > 500) {
          pathPointsRef.current = pathPointsRef.current.slice(-400);
        }
        
        // Добавляем частицы каждые несколько кадров
        if (Math.random() < 0.3) {
          particlesRef.current.push(new Particle(x, y, 'trail'));
        }
      }
      
      // Рисуем путь с плавными кривыми Безье
      if (pathPointsRef.current.length > 2) {
        // Градиент для линии
        const lineGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        if (multiplier < 2) {
          lineGradient.addColorStop(0, '#4ade80');
          lineGradient.addColorStop(1, '#22c55e');
        } else if (multiplier < 5) {
          lineGradient.addColorStop(0, '#fbbf24');
          lineGradient.addColorStop(1, '#f59e0b');
        } else {
          lineGradient.addColorStop(0, '#f87171');
          lineGradient.addColorStop(1, '#ef4444');
        }
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // ИСПРАВЛЕНО: Рисуем очень плавную кривую с кубическими кривыми Безье
        ctx.beginPath();
        ctx.moveTo(pathPointsRef.current[0].x, pathPointsRef.current[0].y);
        
        for (let i = 1; i < pathPointsRef.current.length; i++) {
          const prev = pathPointsRef.current[i - 1];
          const curr = pathPointsRef.current[i];
          
          if (i === 1) {
            // Первая точка - используем quadraticCurveTo
            const cp1x = (prev.x + curr.x) / 2;
            const cp1y = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cp1x, cp1y);
          } else {
            // Остальные точки - используем bezierCurveTo для максимальной плавности
            const prevPrev = pathPointsRef.current[i - 2];
            
            // Контрольные точки для плавной кривой
            const cp1x = prev.x + (curr.x - prevPrev.x) * 0.1;
            const cp1y = prev.y + (curr.y - prevPrev.y) * 0.1;
            const cp2x = curr.x - (curr.x - prev.x) * 0.1;
            const cp2y = curr.y - (curr.y - prev.y) * 0.1;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, curr.x, curr.y);
          }
        }
        
        ctx.stroke();
        
        // Заливка под кривой с градиентом
        const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        fillGradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
        fillGradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        
        // Повторяем путь для заливки
        ctx.lineTo(pathPointsRef.current[0].x, pathPointsRef.current[0].y);
        for (let i = 1; i < pathPointsRef.current.length; i++) {
          const prev = pathPointsRef.current[i - 1];
          const curr = pathPointsRef.current[i];
          
          if (i === 1) {
            const cp1x = (prev.x + curr.x) / 2;
            const cp1y = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cp1x, cp1y);
          } else {
            const prevPrev = pathPointsRef.current[i - 2];
            const cp1x = prev.x + (curr.x - prevPrev.x) * 0.1;
            const cp1y = prev.y + (curr.y - prevPrev.y) * 0.1;
            const cp2x = curr.x - (curr.x - prev.x) * 0.1;
            const cp2y = curr.y - (curr.y - prev.y) * 0.1;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, curr.x, curr.y);
          }
        }
        
        if (pathPointsRef.current.length > 0) {
          const last = pathPointsRef.current[pathPointsRef.current.length - 1];
          ctx.lineTo(last.x, padding + height);
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Анимированная точка на конце (ракета)
        const lastPoint = pathPointsRef.current[pathPointsRef.current.length - 1];
        if (lastPoint) {
          const pulse = Math.sin(Date.now() / 200) * 0.5 + 1;
          const pointSize = 8 * pulse;
          
          // Свечение ракеты
          ctx.shadowColor = multiplier > 5 ? '#fbbf24' : multiplier > 2 ? '#4ade80' : '#22c55e';
          ctx.shadowBlur = 25;
          
          // Основная ракета
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(lastPoint.x, lastPoint.y, pointSize, 0, Math.PI * 2);
          ctx.fill();
          
          // Дополнительное свечение для высоких множителей
          if (multiplier > 3) {
            ctx.shadowBlur = 35;
            ctx.fillStyle = multiplier > 5 ? '#fbbf24' : '#4ade80';
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, pointSize * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.shadowBlur = 0;
        }
      }
      
      // Обновляем и рисуем частицы
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.update();
        particle.draw(ctx);
        return particle.life > 0;
      });
      
      // Главный текст множителя
      const centerX = canvas.width / 2;
      const textY = 80;
      
      // Эффект пульсации для высоких множителей
      const textScale = multiplier > 2 ? 1 + Math.sin(Date.now() / 300) * 0.1 : 1;
      
      ctx.save();
      ctx.translate(centerX, textY);
      ctx.scale(textScale, textScale);
      
      // Тень
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      
      // Цвет текста зависит от множителя
      if (multiplier < 2) {
        ctx.fillStyle = '#22c55e';
      } else if (multiplier < 5) {
        ctx.fillStyle = '#fbbf24';
      } else {
        ctx.fillStyle = '#ef4444';
      }
      
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${multiplier.toFixed(2)}x`, 0, 0);
      
      // Дополнительное свечение для высоких множителей
      if (multiplier > 3) {
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 30;
        ctx.fillText(`${multiplier.toFixed(2)}x`, 0, 0);
      }
      
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    };
    
    // Состояние краша
    const drawCrashedState = (ctx) => {
      // Рисуем путь красным
      if (pathPointsRef.current.length > 1) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        
        ctx.beginPath();
        ctx.moveTo(pathPointsRef.current[0].x, pathPointsRef.current[0].y);
        
        pathPointsRef.current.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Эффект взрыва
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const time = Date.now() / 1000;
      
      // Добавляем частицы взрыва
      if (particlesRef.current.length < 50) {
        for (let i = 0; i < 5; i++) {
          particlesRef.current.push(new Particle(centerX, centerY, 'explosion'));
        }
      }
      
      // Обновляем частицы
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.update();
        particle.draw(ctx);
        return particle.life > 0;
      });
      
      // Анимация взрыва
      const explosionSize = 100 + Math.sin(time * 10) * 20;
      const explosionGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, explosionSize
      );
      explosionGradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      explosionGradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.4)');
      explosionGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
      
      ctx.fillStyle = explosionGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, explosionSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Текст "CRASHED"
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      
      const shake = Math.sin(time * 20) * 2;
      ctx.fillText('CRASHED', centerX + shake, centerY - 30);
      
      // Финальный множитель
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.fillText(`${crashPoint.toFixed(2)}x`, centerX, centerY + 30);
      
      ctx.shadowBlur = 0;
    };
    
    // Состояние загрузки
    const drawLoadingState = (ctx) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Загрузка игры...', centerX, centerY);
    };
    
    draw();
    
    // Анимация
    if (gameState === 'flying' && isAnimatingRef.current) {
      animationRef.current = requestAnimationFrame(draw);
    } else if (gameState === 'crashed') {
      // Анимация взрыва
      animationRef.current = requestAnimationFrame(draw);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [multiplier, gameState, crashPoint, timeToStart, canvasSize]);
  
  // Очистка анимации при размонтировании
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  return (
    <div className={`crash-graph-container ${gameState}`} data-state={gameState}>
      <canvas 
        ref={canvasRef}
        className="crash-graph-canvas"
        style={{ 
          width: '100%', 
          height: '100%',
          imageRendering: 'crisp-edges'
        }}
      />
    </div>
  );
};

export default CrashGraph;
