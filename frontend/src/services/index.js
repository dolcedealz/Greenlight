// index.js
import api, { userApi, gameApi, paymentApi, pvpApi, eventsApi, referralApi } from './api';
import socket from './socket';

export {
  api as default,
  userApi,
  gameApi,
  paymentApi,
  pvpApi,
  eventsApi,
  referralApi,
  socket
};