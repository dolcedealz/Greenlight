// backend/src/utils/logger.js
// !8AB5<0 ;>38@>20=8O 4;O production

const util = require('util');

/**
 * #@>2=8 ;>38@>20=8O
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * "5:CI89 C@>25=L ;>38@>20=8O (<>6=> =0AB@>8BL G5@57 ?5@5<5==CN >:@C65=8O)
 */
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL ? 
  LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO : 
  (process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG);

/**
 * $>@<0B8@>20=85 2@5<5=8
 */
const formatTime = () => {
  return new Date().toISOString();
};

/**
 * $>@<0B8@>20=85 A>>1I5=8O ;>38@>20=8O
 */
const formatMessage = (level, message, data = null) => {
  const timestamp = formatTime();
  const processId = process.pid;
  
  let formatted = `[${timestamp}] [PID:${processId}] [${level}] ${message}`;
  
  if (data !== null && data !== undefined) {
    if (typeof data === 'object') {
      formatted += ` | ${util.inspect(data, { depth: 2, colors: false })}`;
    } else {
      formatted += ` | ${data}`;
    }
  }
  
  return formatted;
};

/**
 * @>25@:0 =C6=> ;8 ;>38@>20BL A>>1I5=85 40==>3> C@>2=O
 */
const shouldLog = (level) => {
  return LOG_LEVELS[level] <= CURRENT_LOG_LEVEL;
};

/**
 * 57>?0A=0O A5@80;870F8O >1J5:B>2 (C18@05B GC2AB28B5;L=K5 40==K5)
 */
const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization', 
    'initData', 'telegramData', 'creditCard', 'cvv'
  ];
  
  const sanitized = { ...obj };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  //  5:C@A82=> >1@010BK205< 2;>65==K5 >1J5:BK
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  });
  
  return sanitized;
};

/**
 * A=>2=>9 :;0AA ;>335@0
 */
class Logger {
  constructor(module = 'APP') {
    this.module = module;
  }
  
  /**
   * >38@>20=85 >H81>: (2A5340 2848<>)
   */
  error(message, error = null) {
    if (!shouldLog('ERROR')) return;
    
    let errorData = null;
    if (error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    const formatted = formatMessage('ERROR', `[${this.module}] ${message}`, errorData);
    console.error(formatted);
    
    //  production <>6=> 4>1028BL >B?@02:C 2 A8AB5<C <>=8B>@8=30
    if (process.env.NODE_ENV === 'production') {
      // TODO: =B53@0F8O A Sentry/DataDog
    }
  }
  
  /**
   * @54C?@5645=8O
   */
  warn(message, data = null) {
    if (!shouldLog('WARN')) return;
    
    const sanitizedData = data ? sanitizeForLogging(data) : null;
    const formatted = formatMessage('WARN', `[${this.module}] ${message}`, sanitizedData);
    console.warn(formatted);
  }
  
  /**
   * =D>@<0F8>==K5 A>>1I5=8O
   */
  info(message, data = null) {
    if (!shouldLog('INFO')) return;
    
    const sanitizedData = data ? sanitizeForLogging(data) : null;
    const formatted = formatMessage('INFO', `[${this.module}] ${message}`, sanitizedData);
    console.log(formatted);
  }
  
  /**
   * B;04>G=0O 8=D>@<0F8O (B>;L:> 2 development)
   */
  debug(message, data = null) {
    if (!shouldLog('DEBUG')) return;
    
    const sanitizedData = data ? sanitizeForLogging(data) : null;
    const formatted = formatMessage('DEBUG', `[${this.module}] ${message}`, sanitizedData);
    console.log(formatted);
  }
  
  /**
   * >38@>20=85 70?@>A>2 API
   */
  request(req, res, duration) {
    if (!shouldLog('INFO')) return;
    
    const sanitizedReq = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.telegramId || 'anonymous'
    };
    
    const message = `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`;
    this.info(message, sanitizedReq);
  }
  
  /**
   * >38@>20=85 D8=0=A>2KE >?5@0F89 (B@51C5B >A>1>3> 2=8<0=8O)
   */
  financial(operation, amount, userId, details = {}) {
    const data = {
      operation,
      amount,
      userId,
      timestamp: new Date().toISOString(),
      details: sanitizeForLogging(details)
    };
    
    const message = `Financial operation: ${operation} ${amount} USDT for user ${userId}`;
    this.info(message, data);
    
    //  production >1O70B5;L=> A>E@0=OBL 2 >B45;L=K9 D09; 8;8 
    if (process.env.NODE_ENV === 'production') {
      // TODO: !?5F80;L=>5 ;>38@>20=85 D8=0=A>2KE >?5@0F89
    }
  }
}

/**
 * !>740=85 ;>335@0 4;O <>4C;O
 */
const createLogger = (module) => {
  return new Logger(module);
};

/**
 * ;>10;L=K9 ;>335@ ?> C<>;G0=8N
 */
const logger = new Logger('GLOBAL');

module.exports = {
  Logger,
  createLogger,
  logger,
  LOG_LEVELS,
  CURRENT_LOG_LEVEL
};