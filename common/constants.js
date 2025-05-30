// common/constants.js - 1I85 :>=AB0=BK 4;O 2A53> ?@>5:B0 Greenlight Casino

/**
 * !"   (  +
 * -B8 :>=AB0=BK 4>;6=K 1KBL A8=E@>=878@>20=K <564C frontend 8 backend
 */
export const CRASH_GAME_CONFIG = {
  // "09<5@K (2 <8;;8A5:C=40E)
  WAITING_TIME: 7000,           // 7 A5:C=4 - ?@85< AB02>:
  CRASH_DELAY: 3000,            // 3 A5:C=4K - ?0C70 ?>A;5 :@0H0
  MULTIPLIER_UPDATE_INTERVAL: 80, // 80<A - >1=>2;5=85 <=>68B5;O
  
  // 3@0=8G5=8O AB02>:
  MIN_BET: 0.01,                // 8=8<0;L=0O AB02:0 2 USDT
  MAX_BET: 1000,                // 0:A8<0;L=0O AB02:0 2 USDT
  MIN_AUTO_CASHOUT: 1.01,       // 8=8<0;L=K9 02B>2K2>4
  MAX_AUTO_CASHOUT: 100.00,     // 0:A8<0;L=K9 02B>2K2>4
  
  // "09<5@K 4;O UI (2 A5:C=40E)
  WAITING_TIME_SECONDS: 7,      // ;O >B>1@065=8O >1@0B=>3> >BAG5B0
  CRASH_DELAY_SECONDS: 3,       // ;O >B>1@065=8O ?0C7K
  
  // 0AB@>9:8 <=>68B5;O
  MULTIPLIER_PRECISION: 2,      // =0:>2 ?>A;5 70?OB>9
  MULTIPLIER_START: 1.00,       // 0G0;L=K9 <=>68B5;L
  
  // 87C0;L=K5 =0AB@>9:8
  GRAPH_UPDATE_FPS: 60,         // FPS 4;O 3@0D8:0 (?@8<5@=> :064K5 16<A)
  ANIMATION_DURATION: 300       // ;8B5;L=>ABL 0=8<0F89 2 <A
};

/**
 * )  + !""+
 */
export const GAME_TYPES = {
  COIN: 'coin',
  SLOTS: 'slots', 
  MINES: 'mines',
  CRASH: 'crash'
};

export const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  FLYING: 'flying',
  CRASHED: 'crashed',
  COMPLETED: 'completed'
};

/**
 * !""+ " !!"+
 */
export const PAYMENT_CONFIG = {
  // 0;NBK
  CURRENCIES: ['USDT', 'BTC', 'ETH', 'LTC', 'BNB'],
  DEFAULT_CURRENCY: 'USDT',
  
  // 8<8BK 45?>78B>2
  MIN_DEPOSIT: 1,
  MAX_DEPOSIT: 10000,
  
  // 8<8BK 2K2>4>2
  MIN_WITHDRAWAL: 5,
  MAX_WITHDRAWAL: 5000,
  
  // !B0BCAK
  STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  }
};

/**
 * !""+  $ , !!"+
 */
export const REFERRAL_CONFIG = {
  // #@>2=8 :><8AA89 (2 ?@>F5=B0E)
  COMMISSION_RATES: {
    LEVEL_1: 10,  // 10% A ?5@2>3> C@>2=O
    LEVEL_2: 5,   // 5% A> 2B>@>3> C@>2=O
    LEVEL_3: 2    // 2% A B@5BL53> C@>2=O
  },
  
  // 8=8<0;L=0O AC<<0 4;O 2K?;0BK
  MIN_PAYOUT: 10,
  
  // !B0BCAK 2K?;0B
  PAYOUT_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    PAID: 'paid',
    REJECTED: 'rejected'
  }
};

/**
 * !""+ ,"
 */
export const USER_CONFIG = {
  // !B0BCAK
  STATUS: {
    ACTIVE: 'active',
    BLOCKED: 'blocked',
    SUSPENDED: 'suspended'
  },
  
  //  >;8
  ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    MODERATOR: 'moderator'
  },
  
  // 0AB@>9:8 ?> C<>;G0=8N
  DEFAULT_SETTINGS: {
    soundEnabled: true,
    vibrationEnabled: true,
    notifications: true,
    language: 'ru'
  }
};

/**
 * !""+ API
 */
export const API_CONFIG = {
  // 5@A8O API
  VERSION: 'v1',
  
  // "09<0CBK (2 <8;;8A5:C=40E)
  REQUEST_TIMEOUT: 30000,
  WEBSOCKET_TIMEOUT: 5000,
  
  // Retry =0AB@>9:8
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Endpoints
  BASE_URL: process.env.REACT_APP_API_URL || '/api',
  WS_URL: process.env.REACT_APP_WS_URL || '/socket.io'
};

/**
 * !""+ TELEGRAM MINI APP
 */
export const TELEGRAM_CONFIG = {
  // "5<K
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark'
  },
  
  //  07<5@K viewport
  MIN_HEIGHT: 500,
  SAFE_AREA_INSET: 20,
  
  // Vibration patterns
  VIBRATION: {
    LIGHT: [10],
    MEDIUM: [30],
    HEAVY: [50],
    SUCCESS: [10, 50, 10],
    ERROR: [100, 50, 100]
  }
};

/**
 * !""+ /   "  "
 */
export const DEBUG_CONFIG = {
  ENABLE_LOGGING: process.env.NODE_ENV === 'development',
  LOG_LEVELS: ['error', 'warn', 'info', 'debug'],
  
  // Mock 40==K5
  USE_MOCK_DATA: false,
  MOCK_DELAY: 1000
};

// -:A?>@B 4;O CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CRASH_GAME_CONFIG,
    GAME_TYPES,
    GAME_STATUS,
    PAYMENT_CONFIG,
    REFERRAL_CONFIG,
    USER_CONFIG,
    API_CONFIG,
    TELEGRAM_CONFIG,
    DEBUG_CONFIG
  };
}