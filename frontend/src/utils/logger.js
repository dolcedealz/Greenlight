// frontend/src/utils/logger.js
// Production-safe logging utility

const isDevelopment = process.env.NODE_ENV !== 'production';
const isLogsEnabled = process.env.REACT_APP_ENABLE_LOGS !== 'false';
const isDebugMode = process.env.REACT_APP_DEBUG_MODE === 'true';

class Logger {
  static log(...args) {
    if (isDevelopment && isLogsEnabled) {
      console.log(...args);
    }
  }

  static warn(...args) {
    if (isDevelopment && isLogsEnabled) {
      console.warn(...args);
    }
  }

  static error(...args) {
    // Errors should always be logged, even in production
    console.error(...args);
  }

  static debug(...args) {
    if (isDevelopment && isDebugMode) {
      console.debug(...args);
    }
  }

  static info(...args) {
    if (isDevelopment && isLogsEnabled) {
      console.info(...args);
    }
  }
}

export default Logger;