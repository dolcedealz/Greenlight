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
          width: rect.width,
          height: rect.height
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
      
      // Сетка
      drawGrid(ctx, padding, graphWidth, graphHeight);
      
      if (gameState === 'waiting') {
        drawWaitingState(ctx, canvas.width, canvas.height, timeToStart);
      } else if (gameState === 'flying') {
        drawFlyingState(ctx, padding, graphWidth, graphHeight, multiplier);
      } else if (gameState === 'crashed') {
        drawCrashedState(ctx, padding, graphWidth, graphHeight, crashPoint);
      }
    };
    
    // Функция отрисовки сетки
    const drawGrid = (ctx, padding, width, height) => {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      
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
        const time = i * 2; // секунды
        ctx.fillText(`${time}s`, x, padding + height + 20);
      }
      
      // Подписи по оси Y (множитель)
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padding + height - (i * height / 4);
        const mult = 1 + i * 2; // множители 1x, 3x, 5x, 7x, 9x
        ctx.fillText(`${mult}x`, padding - 10, y + 4);
      }
    };
    
    // Состояние ожидания
    const drawWaitingState = (ctx, width, height, timeToStart) => {
      // Очищаем точки
      pointsRef.current = [];
      
      // Центральный текст
      ctx.fillStyle = '#0ba84a';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('WAITING', width / 2, height / 2 - 20);
      
      if (timeToStart > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${timeToStart}s`, width / 2, height / 2 + 40);
      }
    };
    
    // Состояние полета
    const drawFlyingState = (ctx, padding, width, height, currentMultiplier) => {
      const now = Date.now();
      
      // Добавляем текущую точку
      const point = {
        x: padding + (pointsRef.current.length * 2),
        y: padding + height - ((currentMultiplier - 1) * height / 8),
        multiplier: currentMultiplier,
        time: now
      };
      
      pointsRef.current.push(point);
      
      // Ограничиваем количество точек
      if (pointsRef.current.length > width / 2) {
        pointsRef.current.shift();
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
        
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        
        for (let i = 1; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
        }
        
        ctx.stroke();
        
        // Заливка под линией
        const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        fillGradient.addColorStop(0, 'rgba(11, 168, 74, 0.3)');
        fillGradient.addColorStop(1, 'rgba(11, 168, 74, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, padding + height);
        
        for (let i = 0; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
        }
        
        ctx.lineTo(point.x, padding + height);
        ctx.closePath();
        ctx.fill();
      }
      
      // Текущий множитель
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(`${currentMultiplier.toFixed(2)}x`, canvas.width / 2, 100);
      ctx.fillText(`${currentMultiplier.toFixed(2)}x`, canvas.width / 2, 100);
    };
    
    // Состояние краха
    const drawCrashedState = (ctx, padding, width, height, crashPoint) => {
      // Рисуем последний график
      if (pointsRef.current.length > 1) {
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        
        for (let i = 1; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
        }
        
        ctx.stroke();
      }
      
      // Текст краха
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText('CRASHED', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText('CRASHED', canvas.width / 2, canvas.height / 2 - 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.strokeText(`${crashPoint.toFixed(2)}x`, canvas.width / 2, canvas.height / 2 + 40);
      ctx.fillText(`${crashPoint.toFixed(2)}x`, canvas.width / 2, canvas.height / 2 + 40);
    };
    
    draw();
    
    // Анимация для состояния полета
    if (gameState === 'flying') {
      animationRef.current = requestAnimationFrame(() => {
        if (animationRef.current) {
          draw();
        }
      });
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [multiplier, gameState, crashPoint, timeToStart, canvasSize]);
  
  return (
    <div className="crash-graph-container">
      <canvas 
        ref={canvasRef}
        className="crash-graph-canvas"
      />
    </div>
  );
};

export default CrashGraph;