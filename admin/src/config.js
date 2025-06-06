// admin/src/config.js
module.exports = {
  // API Configuration
  apiUrl: process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api',
  adminToken: process.env.ADMIN_API_TOKEN,
  
  // Bot Configuration
  botToken: process.env.ADMIN_BOT_TOKEN,
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => Number(id.trim())) : [],
  
  // Timeout settings
  apiTimeout: 30000, // 30 seconds
  
  // Validation
  validate() {
    const errors = [];
    
    if (!this.botToken) {
      errors.push('ADMIN_BOT_TOKEN is required');
    }
    
    if (!this.adminToken) {
      errors.push('ADMIN_API_TOKEN is required for API access');
    }
    
    if (this.adminIds.length === 0) {
      errors.push('ADMIN_IDS should be configured');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};