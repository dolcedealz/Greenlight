// frontend/src/components/games/crash/CrashGraph.js
import React, { useRef, useEffect, useState } from 'react';
import '../../../styles/CrashGraph.css';

const CrashGraph = ({ multiplier, gameState, crashPoint, timeToStart }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const pointsRef = useRef([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // Обновление размеров canvas
  useEffect(() => {
    const updateSize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        setCanvasSize({
          width: Math.max(rect.width, 300),
          height: Math.max(rect.height, 250)
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
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
      
      // Настройки графика
      const padding = 40;
      const graphWidth = canvas.width - padding * 2;
      const graphHeight = canvas.height - padding * 2;
      
      // Фон градиент
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#0a0a0a');
      bgGradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Рисуем в зависимости от состояния игры
      if (gameState === 'waiting') {
        drawWaitingState(ctx, canvas.width, canvas.height, timeToStart);
      } else if (gameState === 'flying') {
        drawGrid(ctx, padding, graphWidth, graphHeight);
        drawFlyingState(ctx, padding, graphWidth, graphHeight, multiplier);
      } else if (gameState === 'crashed') {
        drawGrid(ctx, padding, graphWidth, graphHeight);
        drawCrashedState(ctx, padding, graphWidth, graphHeight, crashPoint);
      }
    };
    
    // Функция отрисовки сетки
    const drawGrid = (ctx, padding, width, height) => {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      
      // Вертикальные линии
      for (let i = 0; i <= 10; i++) {
        const x = padding + (i * width / 10);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + height);
        ctx.stroke();
      }
      
      // Горизонтальные линии
      for (let i = 0; i <= 8; i++) {
        const y = padding + (i * height / 8);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
      }
      
      // Оси
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 2;
      
      // Ось X
      ctx.beginPath();
      ctx.moveTo(padding, padding + height);
      ctx.lineTo(padding + width, padding + height);
      ctx.stroke();
      
      // Ось Y
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, padding + height);
      ctx.stroke();
      
      // Подписи осей
      ctx.fillStyle = '#888888';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      
      // Подписи по оси X (время)
      for (let i = 0; i <= 5; i++) {
        const x = padding + (i * width / 5);
        const time = i * 0.2; // секунды
        ctx.fillText(`${time.toFixed(1)}s`, x, padding + height + 20);
      }
      
      // Подписи по оси Y (множитель)
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padding + height - (i * height / 4);
        const mult = 1 + i * 2; // множители 1x, 3x, 5x, 7x, 9x
        ctx.fillText(`${mult}x`, padding - 10, y + 4);
      }
    };
    
    // Состояние ожидания с обратным отсчетом
    const drawWaitingState = (ctx, width, height, timeToStart) => {
      // Очищаем точки при переходе в состояние ожидания
      pointsRef.current = [];
      
      // Фон градиент для ожидания
      const waitingGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.min(width, height) / 2
      );
      waitingGradient.addColorStop(0, 'rgba(11, 168, 74, 0.1)');
      waitingGradient.addColorStop(1, 'rgba(11, 168, 74, 0.02)');
      ctx.fillStyle = waitingGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Круг обратного отсчета
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 80;
      
      // Фон круга
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#0ba84a';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Прогресс круга
      if (timeToStart > 0 && timeToStart <= 7) { // ИЗМЕНЕНО: с 1 на 7
        const progress = (7 - timeToStart) / 7; // ИЗМЕНЕНО: с 1 на 7
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * progress));
        ctx.strokeStyle = '#0ba84a';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      
      // Основной текст
      ctx.fillStyle = '#0ba84a';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('СТАВКИ', centerX, centerY - 15);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('ПРИНИМАЮТСЯ', centerX, centerY + 15);
      
      // Таймер
      if (timeToStart > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        
        // Тень для цифры
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(`${timeToStart}`, centerX, centerY + 80);
        
        ctx.fillText(`${timeToStart}`, centerX, centerY + 80);
      }
      
      // Дополнительный текст
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '16px Arial';
      ctx.fillText('Следующий раунд начнется через:', centerX, centerY - 60);
    };
    
    // Состояние полета - ИСПРАВЛЕННЫЙ АЛГОРИТМ ЛИНИИ
    const drawFlyingState = (ctx, padding, width, height, currentMultiplier) => {
      const now = Date.now();
      
      // ИСПРАВЛЕНО: Новый алгоритм для изгибающейся линии
      const timeElapsed = pointsRef.current.length * 0.008; // 8ms между точками
      
      // Логарифмическая функция для плавного изгиба
      const logBase = 1.5;
      const timeScale = 0.8;
      const multScale = 0.15;
      
      // X координата: логарифмическая функция времени и множителя
      const xProgress = Math.log(1 + timeElapsed * timeScale + (currentMultiplier - 1) * multScale) / Math.log(logBase);
      const x = padding + Math.min(xProgress * 45, width - 20); // Масштабируем под ширину
      
      // Y координата: обратная логарифмическая функция множителя
      const yProgress = Math.log(currentMultiplier) / Math.log(10); // логарифм по основанию 10
      const y = padding + height - (yProgress * height * 0.8); // 80% высоты для множителя до 10x
      
      const point = {
        x: Math.max(padding, x),
        y: Math.max(padding, Math.min(y, padding + height)),
        multiplier: currentMultiplier,
        time: now
      };
      
      pointsRef.current.push(point);
      
      // Ограничиваем количество точек
      if (pointsRef.current.length > 2000) {
        pointsRef.current = pointsRef.current.slice(-1500);
      }
      
      // Рисуем линию графика
      if (pointsRef.current.length > 1) {
        // Градиент для линии
        const lineGradient = ctx.createLinearGradient(
          pointsRef.current[0].x, 
          pointsRef.current[0].y,
          point.x, 
          point.y
        );
        lineGradient.addColorStop(0, '#0ba84a');
        lineGradient.addColorStop(1, '#4ade80');
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        
        // ИСПРАВЛЕНО: Рисуем плавную кривую
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        
        // Используем quadraticCurveTo для более плавной линии
        for (let i = 1; i < pointsRef.current.length - 1; i++) {
          const current = pointsRef.current[i];
          const next = pointsRef.current[i + 1];
          
          if (next) {
            const controlX = (current.x + next.x) / 2;
            const controlY = (current.y + next.y) / 2;
            ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
          } else {
            ctx.lineTo(current.x, current.y);
          }
        }
        
        // Добавляем последнюю точку
        if (pointsRef.current.length > 1) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        
        ctx.stroke();
        
        // Заливка под линией
        const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        fillGradient.addColorStop(0, 'rgba(11, 168, 74, 0.3)');
        fillGradient.addColorStop(1, 'rgba(11, 168, 74, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        
        // Повторяем кривую для заливки
        for (let i = 0; i < pointsRef.current.length - 1; i++) {
          const current = pointsRef.current[i];
          const next = pointsRef.current[i + 1];
          
          if (next) {
            const controlX = (current.x + next.x) / 2;
            const controlY = (current.y + next.y) / 2;
            if (i === 0) {
              ctx.lineTo(current.x, current.y);
            }
            ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
          }
        }
        
        if (pointsRef.current.length > 0) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(lastPoint.x, padding + height);
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Точка на конце линии
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#0ba84a';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Текущий множитель
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(`${currentMultiplier.toFixed(2)}x`, canvas.width / 2, 100);
      ctx.fillText(`${currentMultiplier.toFixed(2)}x`, canvas.width / 2, 100);
      
      // Эффект мерцания при высоких множителях
      if (currentMultiplier > 2) {
        const glowIntensity = Math.min((currentMultiplier - 2) / 5, 1);
        ctx.shadowColor = '#0ba84a';
        ctx.shadowBlur = 20 * glowIntensity;
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, canvas.width / 2, 100);
        ctx.shadowBlur = 0;
      }
    };
    
    // Состояние краха
    const drawCrashedState = (ctx, padding, width, height, crashPoint) => {
      // Рисуем последний график красным цветом
      if (pointsRef.current.length > 1) {
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        
        // Рисуем кривую красным цветом
        for (let i = 1; i < pointsRef.current.length - 1; i++) {
          const current = pointsRef.current[i];
          const next = pointsRef.current[i + 1];
          
          if (next) {
            const controlX = (current.x + next.x) / 2;
            const controlY = (current.y + next.y) / 2;
            ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
          } else {
            ctx.lineTo(current.x, current.y);
          }
        }
        
        if (pointsRef.current.length > 0) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        
        ctx.stroke();
        
        // Красная заливка
        const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        fillGradient.addColorStop(0, 'rgba(255, 59, 48, 0.3)');
        fillGradient.addColorStop(1, 'rgba(255, 59, 48, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        
        for (let i = 0; i < pointsRef.current.length - 1; i++) {
          const current = pointsRef.current[i];
          const next = pointsRef.current[i + 1];
          
          if (next) {
            const controlX = (current.x + next.x) / 2;
            const controlY = (current.y + next.y) / 2;
            if (i === 0) {
              ctx.lineTo(current.x, current.y);
            }
            ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
          }
        }
        
        if (pointsRef.current.length > 0) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(lastPoint.x, padding + height);
        }
        
        ctx.closePath();
        ctx.fill();
      }
      
      // Анимация взрыва
      const time = Date.now() / 1000;
      const explosionRadius = Math.sin(time * 105) * 25 + 60;
      
      // Красный взрыв в центре
      const explosionGradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2 - 20, 0,
        canvas.width / 2, canvas.height / 2 - 20, explosionRadius
      );
      explosionGradient.addColorStop(0, 'rgba(255, 59, 48, 0.6)');
      explosionGradient.addColorStop(1, 'rgba(255, 59, 48, 0.0)');
      
      ctx.fillStyle = explosionGradient;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 20, explosionRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Текст краха
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText('CRASHED', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText('CRASHED', canvas.width / 2, canvas.height / 2 - 20);
      
      // Множитель краха
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.strokeText(`${crashPoint.toFixed(2)}x`, canvas.width / 2, canvas.height / 2 + 40);
      ctx.fillText(`${crashPoint.toFixed(2)}x`, canvas.width / 2, canvas.height / 2 + 40);
    };
    
    draw();
    
    // Анимация для состояния полета или краха с высокой частотой
    if (gameState === 'flying' || gameState === 'crashed') {
      animationRef.current = requestAnimationFrame(() => {
        draw();
      });
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [multiplier, gameState, crashPoint, timeToStart, canvasSize]);
  
  // Сброс точек при смене состояния игры на ожидание
  useEffect(() => {
    if (gameState === 'waiting') {
      pointsRef.current = [];
    }
  }, [gameState]);
  
  return (
    <div className={`crash-graph-container ${gameState === 'waiting' ? 'loading' : ''}`}>
      <canvas 
        ref={canvasRef}
        className="crash-graph-canvas"
      />
    </div>
  );
};

export default CrashGraph;
