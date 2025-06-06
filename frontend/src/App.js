// frontend/src/App.js - PRODUCTION VERSION WITH LAZY LOADING
import React, { useEffect, useState, Suspense } from 'react';
import { MainScreen } from './screens'; // Главный экран загружаем сразу
import { Navigation } from './components/layout';
import { ErrorBoundary, Loader } from './components/common';
import { initTelegram } from './utils/telegram';
import { userApi } from './services';
import Logger from './utils/logger';
import './styles/global.css';

// Lazy loading для неосновных экранов
const GameScreen = React.lazy(() => import('./screens/GameScreen'));
const ProfileScreen = React.lazy(() => import('./screens/ProfileScreen'));
const HistoryScreen = React.lazy(() => import('./screens/HistoryScreen'));
const EventsScreen = React.lazy(() => import('./screens/EventsScreen'));

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
        } else if (process.env.NODE_ENV === 'development') {
          // Тестовые данные только для development
          telegramUser = {
            id: 123456789,
            first_name: 'Тестовый',
            last_name: 'Пользователь',
            username: 'test_user'
          };
        } else {
          // В продакшене без Telegram данных показываем ошибку
          throw new Error('Приложение должно запускаться только в Telegram');
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
      return balance;
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
  
  // Обработчик выбора событий
  const handleEventsSelect = () => {
    setCurrentScreen('events');
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
    <ErrorBoundary>
      <div className="app">
      {/* Основной контент */}
      {currentScreen === 'main' && (
        <MainScreen 
          userData={userData} 
          telegramWebApp={telegramWebApp}
          onGameSelect={handleGameSelect}
          onEventsSelect={handleEventsSelect} // Добавляем обработчик событий
          balance={balance}
        />
      )}
      
      {currentScreen === 'game' && (
        <Suspense fallback={<div className="screen-loading"><Loader text="Загрузка игры..." /></div>}>
          <GameScreen 
            gameType={gameType}
            userData={userData}
            telegramWebApp={telegramWebApp}
            onBack={handleBackFromGame}
            onBalanceUpdate={updateBalanceFromServer}
            balance={balance}
            setBalance={setBalance}
          />
        </Suspense>
      )}
      
      {currentScreen === 'events' && (
        <Suspense fallback={<div className="screen-loading"><Loader text="Загрузка событий..." /></div>}>
          <EventsScreen 
            userData={userData}
            telegramWebApp={telegramWebApp}
            balance={balance}
            onBalanceUpdate={updateBalanceFromServer}
          />
        </Suspense>
      )}
      
      {currentScreen === 'profile' && (
        <Suspense fallback={<div className="screen-loading"><Loader text="Загрузка профиля..." /></div>}>
          <ProfileScreen 
            userData={userData}
            telegramWebApp={telegramWebApp}
            balance={balance}
            onBalanceUpdate={updateBalanceFromServer}
          />
        </Suspense>
      )}
      
      {currentScreen === 'history' && (
        <Suspense fallback={<div className="screen-loading"><Loader text="Загрузка истории..." /></div>}>
          <HistoryScreen 
            userData={userData}
            telegramWebApp={telegramWebApp}
            balance={balance}
          />
        </Suspense>
      )}

      {/* Навигация */}
      <Navigation 
        currentScreen={currentScreen} 
        onScreenChange={handleScreenChange} 
      />
      </div>
    </ErrorBoundary>
  );
};

export default App;
