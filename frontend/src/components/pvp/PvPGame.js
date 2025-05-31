// frontend/src/components/pvp/PvPGame.js
import React, { useState, useEffect } from 'react';
import PvPLobby from './PvPLobby';
import PvPResult from './PvPResult';
import { useWebApp } from '../../hooks';
import api from '../../services/api';
import '../../styles/PvPGame.css';

const PvPGame = ({ sessionId, userData, onClose }) => {
  const [gamePhase, setGamePhase] = useState('lobby'); // lobby, playing, result, error
  const [sessionData, setSessionData] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const webApp = useWebApp();

  // Обработка начала игры
  const handleGameStart = (result) => {
    console.log('PvP: Игра начата, результат:', result);
    setGameResult(result);
    setGamePhase('result');
    
    // Тактильная обратная связь
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('heavy');
    }
  };

  // Обработка ошибок
  const handleError = (errorMessage) => {
    console.error('PvP: Ошибка игры:', errorMessage);
    setError(errorMessage);
    setGamePhase('error');
    
    if (webApp?.showAlert) {
      webApp.showAlert(`Ошибка: ${errorMessage}`);
    }
  };

  // Обработка реванша
  const handleRematch = async () => {
    try {
      setLoading(true);
      console.log('PvP: Создание реванша для сессии:', sessionId);
      
      // Создаем реванш через API
      const response = await api.post(`/pvp/rematch/${sessionData?.duelId || sessionId}`);
      
      if (response.data.success) {
        console.log('PvP: Реванш создан:', response.data.data);
        
        // Показываем уведомление
        if (webApp?.showAlert) {
          webApp.showAlert('Реванш создан! Ожидаем принятия соперником...');
        }
        
        // Можно перенаправить на новую сессию или показать статус
        // Пока просто закрываем
        handleClose();
      }
    } catch (error) {
      console.error('PvP: Ошибка создания реванша:', error);
      handleError(error.response?.data?.message || 'Ошибка создания реванша');
    } finally {
      setLoading(false);
    }
  };

  // Закрытие игры
  const handleClose = () => {
    if (webApp?.close) {
      webApp.close();
    } else if (onClose) {
      onClose();
    } else {
      // Fallback - попытка закрыть через window
      window.close();
    }
  };

  // Обновление данных сессии
  const updateSessionData = (newData) => {
    setSessionData(prev => ({ ...prev, ...newData }));
  };

  // Эффект для настройки WebApp
  useEffect(() => {
    if (webApp) {
      // Настраиваем основную кнопку
      webApp.MainButton.hide();
      
      // Настраиваем кнопку назад
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleClose);
      
      // Расширяем на весь экран
      webApp.expand();
      
      // Включаем подтверждение закрытия
      webApp.enableClosingConfirmation();
    }

    return () => {
      if (webApp) {
        webApp.BackButton.hide();
        webApp.MainButton.hide();
        webApp.disableClosingConfirmation();
      }
    };
  }, [webApp]);

  // Рендер в зависимости от фазы игры
  const renderContent = () => {
    switch (gamePhase) {
      case 'lobby':
        return (
          <PvPLobby
            sessionId={sessionId}
            userData={userData}
            onGameStart={handleGameStart}
            onError={handleError}
            onSessionUpdate={updateSessionData}
          />
        );

      case 'result':
        return (
          <PvPResult
            gameResult={gameResult}
            sessionData={sessionData}
            onRematch={handleRematch}
            onClose={handleClose}
          />
        );

      case 'error':
        return (
          <div className="pvp-error">
            <div className="error-content">
              <h2>❌ Ошибка</h2>
              <p>{error}</p>
              <div className="error-actions">
                <button 
                  className="retry-button"
                  onClick={() => {
                    setError(null);
                    setGamePhase('lobby');
                  }}
                >
                  🔄 Попробовать снова
                </button>
                <button 
                  className="close-button"
                  onClick={handleClose}
                >
                  ❌ Закрыть
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="pvp-loading">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Загрузка PvP игры...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="pvp-game">
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Обработка запроса...</p>
          </div>
        </div>
      )}
      
      {renderContent()}
    </div>
  );
};

export default PvPGame;