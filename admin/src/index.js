// src/index.js
const commands = require('./commands');
const middleware = require('./middleware');
const handlers = require('./handlers');

module.exports = {
  commands,
  middleware,
  handlers
};