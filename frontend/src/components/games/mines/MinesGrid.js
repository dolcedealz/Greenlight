// frontend/src/components/games/mines/MinesGrid.js - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import '../../../styles/MinesGrid.css';

const MinesGrid = ({ grid, clickedCells = [], onCellClick, gameActive, gameOver, loading }) => {
  const { gameActionFeedback } = useTactileFeedback();
  
  // ОПТИМИЗАЦИЯ: Детектор производительности устройства
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  
  useEffect(() => {
    // Простая проверка производительности устройства
    const checkPerformance = () => {
      const start = performance.now();
      for (let i = 0; i < 5000; i++) {
        Math.random();
      }
      const end = performance.now();
      const isLow = (end - start) > 8; // Если операция заняла больше 8ms
      setIsLowPerformance(isLow);
    };
    
    checkPerformance();
  }, []);

  // ОПТИМИЗАЦИЯ: Мемоизируем сет открытых ячеек для быстрого поиска
  const clickedCellsSet = useMemo(() => {
    const set = new Set();
    clickedCells.forEach(cell => {
      set.add(`${cell[0]}-${cell[1]}`);
    });
    return set;
  }, [clickedCells]);

  // Обработчик клика по ячейке
  const handleCellClick = useCallback((rowIndex, colIndex) => {
    // Блокируем клики если:
    // - игра не активна
    // - игра завершена
    // - идет загрузка
    // - ячейка уже открыта
    
    // ОПТИМИЗАЦИЯ: Используем Set для быстрой проверки
    const cellKey = `${rowIndex}-${colIndex}`;
    const alreadyClicked = clickedCellsSet.has(cellKey);
    
    if (!gameActive || gameOver || loading || alreadyClicked) {
      return;
    }
    
    // Вибрация при клике по ячейке
    gameActionFeedback();
    
    // Вызываем обработчик из родительского компонента
    onCellClick(rowIndex, colIndex);
  }, [gameActive, gameOver, loading, clickedCellsSet, gameActionFeedback, onCellClick]);

  // ОПТИМИЗАЦИЯ: Мемоизированный компонент ячейки
  const CellComponent = React.memo(({ cell, rowIndex, colIndex, isRevealed, cellClass, gameOver }) => (
    <div
      className={cellClass}
      onClick={() => handleCellClick(rowIndex, colIndex)}
    >
      {(isRevealed || gameOver) && cell === 'mine' && <span className="mine-icon">💣</span>}
      {isRevealed && cell === 'gem' && <span className="gem-icon">💎</span>}
    </div>
  ));

  return (
    <div className={`mines-grid ${gameOver ? 'game-over' : ''} ${isLowPerformance ? 'low-performance' : ''}`}>
      {loading && (
        <div className="mines-overlay">
          <div className="mines-spinner"></div>
        </div>
      )}
      
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="mines-row">
          {row.map((cell, colIndex) => {
            // ОПТИМИЗАЦИЯ: Используем Set для быстрой проверки
            const cellKey = `${rowIndex}-${colIndex}`;
            const isRevealed = clickedCellsSet.has(cellKey);
            
            // ИСПРАВЛЕНИЕ: При завершении игры показываем все мины
            const shouldShowMine = cell === 'mine' && (isRevealed || gameOver);
            const shouldShowGem = cell === 'gem' && isRevealed;
            
            
            const cellClass = `mines-cell 
              ${isRevealed || (gameOver && cell === 'mine') ? 'revealed' : ''} 
              ${shouldShowMine ? 'mine' : ''} 
              ${shouldShowGem ? 'gem' : ''}
              ${!gameActive && !isRevealed && !(gameOver && cell === 'mine') ? 'disabled' : ''}
            `;
            
            return (
              <CellComponent
                key={colIndex}
                cell={cell}
                rowIndex={rowIndex}
                colIndex={colIndex}
                isRevealed={isRevealed}
                cellClass={cellClass}
                gameOver={gameOver}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default React.memo(MinesGrid);
