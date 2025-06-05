// index.js
import api, { userApi, gameApi, paymentApi, eventsApi, referralApi, duelApi } from './api';
import socket from './socket';

export {
  api as default,
  userApi,
  gameApi,
  paymentApi,
  eventsApi,
  referralApi,
  duelApi,
  socket
};