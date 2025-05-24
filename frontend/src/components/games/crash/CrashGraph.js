// frontend/src/components/games/crash/CrashGraph.js
import React, { useRef, useEffect, useState } from 'react';
import '../../../styles/CrashGraph.css';

const CrashGraph = ({ multiplier, gameState, crashPoint, timeToStart, roundId, userCashedOut }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const pointsRef = useRef([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const lastRoundIdRef = useRef(roundId);
  const gameStartTimeRef = useRef(null);
  const lastGameStateRef = useRef(gameState);
  
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
  
  // ИСПРАВЛЕНО: Очистка точек ТОЛЬКО при реальной смене раунда
  useEffect(() => {
    // Очищаем точки ТОЛЬКО при смене roundId (новый раунд)
    if (roundId !== lastRoundIdRef.current) {
      console.log('ГРАФИК: Новый раунд, очищаем точки', { 
        newRound: roundId, 
        oldRound: lastRoundIdRef.current 
      });
      pointsRef.current = [];
      gameStartTimeRef.current = null;
      lastRoundIdRef.current = roundId;
    }
    
    // НЕ очищаем точки при смене gameState внутри одного раунда!
    lastGameStateRef.current = gameState;
  }, [roundId]); // УБИРАЕМ gameState из зависимостей!
  
  // Запоминаем время начала полета
  useEffect(() => {
    if (gameState === 'flying' && gameStartTimeRef.current === null) {
      gameStartTimeRef.current = Date.now();
      console.log('ГРАФИК: Начался полет, время старта:', gameStartTimeRef.current);
    }
    
    // НЕ сбрасываем gameStartTimeRef при waiting, только при новом раунде
  }, [gameState]);
  
  // Остановка анимации при смене состояния на не-flying
  useEffect(() => {
    if (gameState !== 'flying' && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [gameState]);
  
  // Основная функция рисования - УБРАЛИ userCashedOut из зависимостей
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
        const time = i * 0.2;
        ctx.fillText(`${time.toFixed(1)}s`, x, padding + height + 20);
      }
      
      // Подписи по оси Y (множитель)
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padding + height - (i * height / 4);
        const mult = 1 + i * 2;
        ctx.fillText(`${mult}x`, padding - 10, y + 4);
      }
    };
    
    // Состояние ожидания с обратным отсчетом
    const drawWaitingState = (ctx, width, height, timeToStart) => {
      const waitingGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.min(width, height) / 2
      );
      waitingGradient.addColorStop(0, 'rgba(11, 168, 74, 0.1)');
      waitingGradient.addColorStop(1, 'rgba(11, 168, 74, 0.02)');
      ctx.fillStyle = waitingGradient;
      ctx.fillRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 80;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#0ba84a';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      if (timeToStart > 0 && timeToStart <= 7) {
        const progress = (7 - timeToStart) / 7;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * progress));
        ctx.strokeStyle = '#0ba84a';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      
      ctx.fillStyle = '#0ba84a';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('СТАВКИ', centerX, centerY - 15);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('ПРИНИМАЮТСЯ', centerX, centerY + 15);
      
      if (timeToStart > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(`${timeToStart}`, centerX, centerY + 80);
        
        ctx.fillText(`${timeToStart}`, centerX, centerY + 80);
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '16px Arial';
      ctx.fillText('Следующий раунд начнется через:', centerX, centerY - 60);
    };
    
    // ИСПРАВЛЕНО: Состояние полета - график ВСЕГДА продолжает расти
    const drawFlyingState = (ctx, padding, width, height, currentMultiplier) => {
      // КРИТИЧЕСКИ ВАЖНО: Добавляем точку при каждом кадре во время полета
      // НЕЗАВИСИМО от статуса кешаута пользователя
      if (gameStartTimeRef.current && currentMultiplier >= 1.0) {
        const realTimeElapsed = (Date.now() - gameStartTimeRef.current) / 1000;
        
        // Стабильная формула координат
        const timeBasedX = Math.sqrt(realTimeElapsed * 0.5) * 100;
        const x = padding + Math.min(timeBasedX, width - 20);
        
        // Y основан на логарифме множителя
        const logMultiplier = Math.log(Math.max(currentMultiplier, 1.01));
        const maxLogValue = Math.log(10); // до 10x
        const yProgress = Math.min(logMultiplier / maxLogValue, 1);
        const y = padding + height - (yProgress * height * 0.8);
        
        const newPoint = {
          x: Math.max(padding, Math.min(x, padding + width - 10)),
          y: Math.max(padding + 10, Math.min(y, padding + height - 10)),
          multiplier: currentMultiplier,
          time: Date.now()
        };
        
        // Добавляем точку ВСЕГДА, невзирая на кешаут
        pointsRef.current.push(newPoint);
        
        // Ограничиваем массив для производительности
        if (pointsRef.current.length > 2000) {
          pointsRef.current = pointsRef.current.slice(-1500);
        }
      }
      
      // Рисуем линию графика если есть точки
      if (pointsRef.current.length > 1) {
        // Линия ВСЕГДА зеленая, кешаут не влияет на цвет графика
        ctx.strokeStyle = '#0ba84a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        
        for (let i = 1; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
        }
        
        ctx.stroke();
        
        // Заливка под графиком
        const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        fillGradient.addColorStop(0, 'rgba(11, 168, 74, 0.3)');
        fillGradient.addColorStop(1, 'rgba(11, 168, 74, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        
        pointsRef.current.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        
        if (pointsRef.current.length > 0) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, padding + height);
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Точка на конце - всегда отображается
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#0ba84a';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Текущий множитель - всегда отображается
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
      
      // УБРАЛИ отображение статуса кешаута, чтобы не мешать графику
      // График должен лететь независимо от действий пользователя
    };
    
    // Состояние краха
    const drawCrashedState = (ctx, padding, width, height, crashPoint) => {
      // Рисуем последний график красным
      if (pointsRef.current.length > 1) {
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        
        for (let i = 1; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
        }
        
        ctx.stroke();
        
        // Красная заливка
        const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        fillGradient.addColorStop(0, 'rgba(255, 59, 48, 0.3)');
        fillGradient.addColorStop(1, 'rgba(255, 59, 48, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        
        pointsRef.current.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        
        if (pointsRef.current.length > 0) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 1];
          ctx.lineTo(lastPoint.x, padding + height);
        }
        
        ctx.closePath();
        ctx.fill();
      }
      
      // Анимация взрыва
      const time = Date.now() / 1000;
      const explosionRadius = Math.sin(time * 10) * 25 + 60;
      
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
    
    // Анимация только для состояния полета
    if (gameState === 'flying') {
      animationRef.current = requestAnimationFrame(draw);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [multiplier, gameState, crashPoint, timeToStart, canvasSize]); // УБРАЛИ userCashedOut!
  
  return (
    <div className={`crash-graph-container ${gameState === 'waiting' ? 'loading' : ''}`} data-state={gameState}>
      <canvas 
        ref={canvasRef}
        className="crash-graph-canvas"
      />
    </div>
  );
};

export default CrashGraph;
