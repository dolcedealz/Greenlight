// frontend/src/services/giveaway.api.js
import api from './api';

export const giveawayApi = {
  // Получить активные розыгрыши
  getActiveGiveaways: () => {
    return api.get('/giveaways/active');
  },

  // Участие в розыгрыше
  participateInGiveaway: (giveawayId) => {
    return api.post(`/giveaways/${giveawayId}/participate`);
  },

  // Проверить статус участия в розыгрыше
  checkParticipationStatus: (giveawayId) => {
    return api.get(`/giveaways/${giveawayId}/participation-status`);
  },

  // Получить историю участия пользователя
  getUserParticipationHistory: (page = 1, limit = 10) => {
    return api.get('/giveaways/my-participations', {
      params: { page, limit }
    });
  }
};