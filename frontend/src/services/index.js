// index.js
import api, { userApi, gameApi, paymentApi, eventsApi, referralApi } from './api';
import socket from './socket';

export {
  api as default,
  userApi,
  gameApi,
  paymentApi,
  eventsApi,
  referralApi,
  socket
};