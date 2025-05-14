// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import { MainScreen, GameScreen, ProfileScreen, HistoryScreen } from './screens';
import { Navigation } from './components/layout';
import { initTelegram } from './utils/telegram';
import { userApi } from './services';
import './styles/global.css';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [gameType, setGameType] = useState(null);
  const [userData, setUserData] = useState(null);
  const [telegramWebApp, setTelegramWebApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Инициализация Telegram Mini App
        let webApp;
        try {
          webApp = initTelegram();
          setTelegramWebApp(webApp);
        } catch (error) {
          console.warn('Telegram WebApp не инициализирован:', error);
          // Продолжаем работу без Telegram WebApp (для разработки в браузере)
        }
        
        // Получение данных пользователя из Telegram WebApp
        let telegramUser;
        if (webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
          telegramUser = webApp.initDataUnsafe.user;
        } else {
          // Устанавливаем тестовые данные для разработки
          telegramUser = {
            id: 123456789,
            first_name: 'Тестовый',
            last_name: 'Пользователь',
            username: 'test_user'
          };
        }
        
        // Аутентификация пользователя на сервере
        try {
          const authResponse = await userApi.authWithTelegram(telegramUser);
          setUserData(authResponse.data.data.user);
          setBalance(authResponse.data.data.user.balance);
        } catch (authError) {
          console.error('Ошибка аутентификации:', authError);
          setError('Ошибка аутентификации. Пожалуйста, попробуйте еще раз.');
        }
        
        // Расширение окна (если в Telegram)
        if (webApp) {
          webApp.expand();
        }
        
        // Анализ параметров URL
        const urlParams = new URLSearchParams(window.location.search);
        const screenParam = urlParams.get('screen');
        const gameParam = urlParams.get('game');
        
        if (gameParam) {
          setGameType(gameParam);
          setCurrentScreen('game');
        } else if (screenParam) {
          setCurrentScreen(screenParam);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Ошибка инициализации:', error);
        setError('Произошла ошибка при инициализации приложения.');
        setLoading(false);
      }
    };
    
    init();
  }, []);

  // Функция для обновления баланса из API
  const updateBalanceFromServer = async () => {
    try {
      const balanceResponse = await userApi.getBalance();
      setBalance(balanceResponse.data.data.balance);
      return balanceResponse.data.data.balance;
    } catch (err) {
      console.error('Ошибка при обновлении баланса:', err);
      return balance; // Возвращаем текущий баланс в случае ошибки
    }
  };

  // Обработчик изменения экрана
  const handleScreenChange = (screen) => {
    // Обновляем баланс при смене экрана
    if (currentScreen === 'game' && screen !== 'game') {
      updateBalanceFromServer();
    }
    setCurrentScreen(screen);
  };
  
  // Обработчик выбора игры
  const handleGameSelect = (game) => {
    setGameType(game);
    setCurrentScreen('game');
  };
  
  // Обработчик возврата из игры
  const handleBackFromGame = () => {
    updateBalanceFromServer();
    setCurrentScreen('main');
  };

  // Отображение экрана загрузки
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка Greenlight Casino...</p>
      </div>
    );
  }

  // Отображение ошибки
  if (error) {
    return (
      <div className="error-screen">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Попробовать снова</button>
      </div>
    );
  }

  // Отображение основного контента
  return (
    <div className="app">
      {/* Основной контент */}
      {currentScreen === 'main' && (
        <MainScreen 
          userData={userData} 
          telegramWebApp={telegramWebApp}
          onGameSelect={handleGameSelect}
          balance={balance}
        />
      )}
      
      {currentScreen === 'game' && (
        <GameScreen 
          gameType={gameType}
          userData={userData}
          telegramWebApp={telegramWebApp}
          onBack={handleBackFromGame}
          onBalanceUpdate={updateBalanceFromServer}
          balance={balance}
          setBalance={setBalance}
        />
      )}
      
      {currentScreen === 'profile' && (
        <ProfileScreen 
          userData={userData}
          telegramWebApp={telegramWebApp}
          balance={balance}
          onBalanceUpdate={updateBalanceFromServer}
        />
      )}
      
      {currentScreen === 'history' && (
        <HistoryScreen 
          userData={userData}
          telegramWebApp={telegramWebApp}
          balance={balance}
        />
      )}
      
      {/* Навигация */}
      <Navigation 
        currentScreen={currentScreen} 
        onScreenChange={handleScreenChange} 
      />
    </div>
  );
};

export default App;