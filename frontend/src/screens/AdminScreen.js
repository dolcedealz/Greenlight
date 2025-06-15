// frontend/src/screens/AdminScreen.js
import React, { useState, useEffect } from 'react';
import { giveawayApi } from '../services';
import '../styles/AdminScreen.css';

const AdminScreen = () => {
  const [activeTab, setActiveTab] = useState('prizes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Данные призов
  const [prizes, setPrizes] = useState([]);
  const [prizesLoading, setPrizesLoading] = useState(false);
  
  // Данные розыгрышей
  const [giveaways, setGiveaways] = useState([]);
  const [giveawaysLoading, setGiveawaysLoading] = useState(false);
  
  // Статистика
  const [stats, setStats] = useState(null);
  
  // Модальные окна
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showGiveawayModal, setShowGiveawayModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState(null);
  const [editingGiveaway, setEditingGiveaway] = useState(null);

  useEffect(() => {
    if (activeTab === 'prizes') {
      loadPrizes();
    } else if (activeTab === 'giveaways') {
      loadGiveaways();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab]);

  // Загрузка призов
  const loadPrizes = async () => {
    try {
      setPrizesLoading(true);
      const response = await fetch('/api/admin/giveaways/prizes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPrizes(data.data.prizes);
      } else {
        throw new Error('Ошибка загрузки призов');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPrizesLoading(false);
    }
  };

  // Загрузка розыгрышей
  const loadGiveaways = async () => {
    try {
      setGiveawaysLoading(true);
      const response = await fetch('/api/admin/giveaways/giveaways', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGiveaways(data.data.giveaways);
      } else {
        throw new Error('Ошибка загрузки розыгрышей');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGiveawaysLoading(false);
    }
  };

  // Загрузка статистики
  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/giveaways/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      } else {
        throw new Error('Ошибка загрузки статистики');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Создание/редактирование приза
  const savePrize = async (prizeData) => {
    try {
      const url = editingPrize 
        ? `/api/admin/giveaways/prizes/${editingPrize._id}`
        : '/api/admin/giveaways/prizes';
      
      const method = editingPrize ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prizeData)
      });
      
      if (response.ok) {
        setShowPrizeModal(false);
        setEditingPrize(null);
        loadPrizes();
        alert('Приз успешно сохранен!');
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  // Создание/редактирование розыгрыша
  const saveGiveaway = async (giveawayData) => {
    try {
      const url = editingGiveaway 
        ? `/api/admin/giveaways/giveaways/${editingGiveaway._id}`
        : '/api/admin/giveaways/giveaways';
      
      const method = editingGiveaway ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(giveawayData)
      });
      
      if (response.ok) {
        setShowGiveawayModal(false);
        setEditingGiveaway(null);
        loadGiveaways();
        alert('Розыгрыш успешно сохранен!');
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  // Активация розыгрыша
  const activateGiveaway = async (giveawayId) => {
    try {
      const response = await fetch(`/api/admin/giveaways/giveaways/${giveawayId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        loadGiveaways();
        alert('Розыгрыш активирован!');
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  // Проведение розыгрыша
  const conductGiveaway = async (giveawayId) => {
    if (!confirm('Провести розыгрыш? Это действие нельзя отменить.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/giveaways/giveaways/${giveawayId}/conduct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        loadGiveaways();
        alert(`Розыгрыш проведен! Победители: ${data.data.winnersInfo.map(w => w.user.firstName).join(', ')}`);
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const renderPrizesTab = () => (
    <div className="admin-section">
      <div className="section-header">
        <h2>Управление призами</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingPrize(null);
            setShowPrizeModal(true);
          }}
        >
          Добавить приз
        </button>
      </div>
      
      {prizesLoading ? (
        <div className="loading">Загрузка призов...</div>
      ) : (
        <div className="prizes-grid">
          {prizes.map(prize => (
            <div key={prize._id} className="prize-card">
              <div className="prize-header">
                <h3>{prize.name}</h3>
                <span className={`prize-type ${prize.type}`}>
                  {prize.type === 'telegram_gift' ? 'Telegram Gift' :
                   prize.type === 'promo_code' ? 'Промокод' : 'Бонус'}
                </span>
              </div>
              <p className="prize-description">{prize.description}</p>
              <div className="prize-value">Стоимость: {prize.value} USDT</div>
              <div className="prize-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingPrize(prize);
                    setShowPrizeModal(true);
                  }}
                >
                  Редактировать
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGiveawaysTab = () => (
    <div className="admin-section">
      <div className="section-header">
        <h2>Управление розыгрышами</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingGiveaway(null);
            setShowGiveawayModal(true);
          }}
        >
          Создать розыгрыш
        </button>
      </div>
      
      {giveawaysLoading ? (
        <div className="loading">Загрузка розыгрышей...</div>
      ) : (
        <div className="giveaways-list">
          {giveaways.map(giveaway => (
            <div key={giveaway._id} className="giveaway-card">
              <div className="giveaway-header">
                <h3>{giveaway.title}</h3>
                <span className={`giveaway-status ${giveaway.status}`}>
                  {giveaway.status === 'pending' ? 'Ожидает' :
                   giveaway.status === 'active' ? 'Активный' :
                   giveaway.status === 'completed' ? 'Завершен' : 'Отменен'}
                </span>
              </div>
              
              <div className="giveaway-details">
                <p><strong>Приз:</strong> {giveaway.prize?.name}</p>
                <p><strong>Тип:</strong> {giveaway.type === 'daily' ? 'Ежедневный' : giveaway.type === 'weekly' ? 'Недельный' : 'Кастомный'}</p>
                <p><strong>Победителей:</strong> {giveaway.winnersCount}</p>
                <p><strong>Участников:</strong> {giveaway.participationCount}</p>
                <p><strong>Розыгрыш:</strong> {new Date(giveaway.drawDate).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК</p>
              </div>
              
              <div className="giveaway-actions">
                {giveaway.status === 'pending' && (
                  <button 
                    className="btn btn-success"
                    onClick={() => activateGiveaway(giveaway._id)}
                  >
                    Активировать
                  </button>
                )}
                
                {giveaway.status === 'active' && (
                  <button 
                    className="btn btn-warning"
                    onClick={() => conductGiveaway(giveaway._id)}
                  >
                    Провести розыгрыш
                  </button>
                )}
                
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingGiveaway(giveaway);
                    setShowGiveawayModal(true);
                  }}
                >
                  Редактировать
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStatsTab = () => (
    <div className="admin-section">
      <h2>Статистика системы</h2>
      
      {loading ? (
        <div className="loading">Загрузка статистики...</div>
      ) : stats ? (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Общая статистика</h3>
            <div className="stat-item">
              <span>Всего розыгрышей:</span>
              <span>{stats.overview.totalGiveaways}</span>
            </div>
            <div className="stat-item">
              <span>Активных:</span>
              <span>{stats.overview.activeGiveaways}</span>
            </div>
            <div className="stat-item">
              <span>Завершенных:</span>
              <span>{stats.overview.completedGiveaways}</span>
            </div>
            <div className="stat-item">
              <span>Всего участий:</span>
              <span>{stats.overview.totalParticipations}</span>
            </div>
            <div className="stat-item">
              <span>Призов:</span>
              <span>{stats.overview.totalPrizes}</span>
            </div>
          </div>
          
          <div className="stat-card">
            <h3>По типам розыгрышей</h3>
            {stats.giveawaysByType.map(type => (
              <div key={type._id} className="stat-item">
                <span>{type._id === 'daily' ? 'Ежедневные' : 'Недельные'}:</span>
                <span>{type.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>Ошибка загрузки статистики</div>
      )}
    </div>
  );

  return (
    <div className="admin-screen">
      <div className="admin-header">
        <h1>Админ-панель розыгрышей</h1>
      </div>
      
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'prizes' ? 'active' : ''}`}
          onClick={() => setActiveTab('prizes')}
        >
          Призы
        </button>
        <button 
          className={`tab-button ${activeTab === 'giveaways' ? 'active' : ''}`}
          onClick={() => setActiveTab('giveaways')}
        >
          Розыгрыши
        </button>
        <button 
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Статистика
        </button>
      </div>
      
      <div className="admin-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        {activeTab === 'prizes' && renderPrizesTab()}
        {activeTab === 'giveaways' && renderGiveawaysTab()}
        {activeTab === 'stats' && renderStatsTab()}
      </div>
      
      {/* Модальные окна будут добавлены отдельно */}
    </div>
  );
};

export default AdminScreen;