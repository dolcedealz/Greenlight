// index.js
import api, { userApi, gameApi, paymentApi, eventsApi, referralApi, duelApi } from './api';
import socket from './socket';
import { giveawayApi } from './giveaway.api';

export {
  api as default,
  userApi,
  gameApi,
  paymentApi,
  eventsApi,
  referralApi,
  duelApi,
  giveawayApi,
  socket
};