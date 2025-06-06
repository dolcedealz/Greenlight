// frontend/src/components/common/ErrorBoundary.js
import React from 'react';
import Logger from '../../utils/logger';
import '../../styles/ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Обновляем состояние так, чтобы следующий рендер показал fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Логируем ошибку
    Logger.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Отправляем ошибку в сервис мониторинга (если есть)
    // Например: Sentry.captureException(error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>🚨 Что-то пошло не так</h2>
            <p>Произошла неожиданная ошибка в приложении.</p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Подробности ошибки (только в разработке)</summary>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleReload} className="btn btn-primary">
                Перезагрузить страницу
              </button>
              
              {window.Telegram?.WebApp && (
                <button 
                  onClick={() => window.Telegram.WebApp.close()} 
                  className="btn btn-secondary"
                >
                  Закрыть приложение
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;