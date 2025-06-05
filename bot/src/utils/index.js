// utils/index.js
const { checkChatType, requirePrivateChat, requireGroupChat } = require('./chat-utils');
const { getWebAppUrl, createWebAppButton, createWebAppKeyboard } = require('./webapp-utils');

module.exports = {
  checkChatType,
  requirePrivateChat,
  requireGroupChat,
  getWebAppUrl,
  createWebAppButton,
  createWebAppKeyboard
};