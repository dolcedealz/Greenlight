import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CoinFlip3D from './CoinFlip3D';
import PlayerCard from './PlayerCard';

const PvPCoin = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('pvp');
  
  const [gameState, setGameState] = useState({
    status: 'connecting',
    challenger: null,
    opponent: null,
    myRole: null,
    mySide: null,
    result: null
  });
  
  useEffect(() => {
    if (sessionId) {
      joinSession();
      // Подключаемся к WebSocket для real-time обновлений
      connectWebSocket();
    }
  }, [sessionId]);
  
  const joinSession = async () => {
    try {
      const response = await api.post(`/pvp/join/${sessionId}`);
      setGameState({
        ...response.data,
        status: 'waiting'
      });
    } catch (error) {
      console.error('Ошибка присоединения:', error);
    }
  };
  
  const setReady = async () => {
    try {
      await api.post(`/pvp/ready/${sessionId}`, { ready: true });
      setGameState(prev => ({ ...prev, status: 'ready' }));
    } catch (error) {
      console.error('Ошибка готовности:', error);
    }
  };
  
  const startGame = async () => {
    try {
      const response = await api.post(`/pvp/start/${sessionId}`);
      
      // Запускаем анимацию
      setGameState(prev => ({ 
        ...prev, 
        status: 'flipping',
        result: response.data.result 
      }));
      
      // Через 3 секунды показываем результат
      setTimeout(() => {
        setGameState(prev => ({ 
          ...prev, 
          status: 'completed',
          winnerId: response.data.winnerId
        }));
      }, 3000);
      
    } catch (error) {
      console.error('Ошибка запуска:', error);
    }
  };
  
  return (
    <div className="pvp-container">
      {/* Игроки */}
      <div className="players-row">
        <PlayerCard 
          player={gameState.challenger}
          side="heads"
          isReady={gameState.challengerReady}
          isWinner={gameState.winnerId === gameState.challengerId}
        />
        
        <div className="vs">VS</div>
        
        <PlayerCard 
          player={gameState.opponent}
          side="tails"
          isReady={gameState.opponentReady}
          isWinner={gameState.winnerId === gameState.opponentId}
        />
      </div>
      
      {/* Монетка */}
      <div className="coin-area">
        <CoinFlip3D 
          isFlipping={gameState.status === 'flipping'}
          result={gameState.result}
          size="large"
        />
      </div>
      
      {/* Информация об игре */}
      <div className="game-info">
        <div className="stake">Ставка: {gameState.amount} USDT каждый</div>
        <div className="bank">Банк: {gameState.winAmount} USDT</div>
      </div>
      
      {/* Кнопки действий */}
      <div className="actions">
        {gameState.status === 'waiting' && !gameState.myReady && (
          <button onClick={setReady} className="btn-ready">
            Готов к игре
          </button>
        )}
        
        {gameState.status === 'ready' && gameState.bothReady && (
          <button onClick={startGame} className="btn-start">
            Бросить монетку!
          </button>
        )}
        
        {gameState.status === 'completed' && (
          <div className="result">
            {gameState.winnerId === userId ? (
              <div className="win">
                🎉 Вы выиграли {gameState.winAmount} USDT!
              </div>
            ) : (
              <div className="lose">
                😔 Вы проиграли. Попробуйте еще раз!
              </div>
            )}
            <button onClick={offerRematch} className="btn-rematch">
              Реванш
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PvPCoin;