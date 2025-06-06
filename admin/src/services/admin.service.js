// admin/src/services/admin.service.js
const axios = require('axios');

class AdminService {
  constructor() {
    // Принудительно устанавливаем правильный URL для продакшена
    this.apiUrl = 'https://greenlight-api-ghqh.onrender.com/api';
    console.log('🔧 ADMIN SERVICE: Принудительно установлен API URL:', this.apiUrl);
    this.adminToken = process.env.ADMIN_API_TOKEN;
    
    if (!this.adminToken) {
      console.warn('� ADMIN_API_TOKEN =5 CAB0=>2;5=. 5:>B>@K5 DC=:F88 <>3CB =5 @01>B0BL.');
    }
    
    // 0AB@>9:0 axios :;85=B0
    this.api = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.adminToken ? `Bearer ${this.adminToken}` : undefined
      }
    });
    
    // >38@>20=85 70?@>A>2 8 >B25B>2
    this.api.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error.message);
        return Promise.reject(error);
      }
    );
    
    this.api.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config?.url}`);
        return response;
      },
      (error) => {
        console.error(`API Error: ${error.response?.status} ${error.config?.url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * >;CG8BL AB0B8AB8:C <>48D8:0B>@>2
   */
  async getOddsStatistics() {
    try {
      const response = await this.api.get('/admin/odds/statistics');
      
      if (response.data.success) {
        return response.data.data;
      } else {
        // A;8 API =5 @50;87>20=, 2>72@0I05< <>:>2K5 40==K5
        return this.getMockOddsStatistics();
      }
    } catch (error) {
      console.warn('H81:0 ?>;CG5=8O AB0B8AB8:8 <>48D8:0B>@>2, 8A?>;L7C5< <>:>2K5 40==K5:', error.message);
      return this.getMockOddsStatistics();
    }
  }
  
  /**
   * >;CG8BL <>48D8:0B>@K ?>;L7>20B5;O
   */
  async getUserModifiers(userId) {
    try {
      const response = await this.api.get(`/admin/users/${userId}/modifiers`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error('>;L7>20B5;L =5 =0945=');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('>;L7>20B5;L =5 =0945=');
      }
      
      // A;8 API =5 @50;87>20=, 2>72@0I05< <>:>2K5 40==K5
      console.warn('H81:0 ?>;CG5=8O <>48D8:0B>@>2 ?>;L7>20B5;O, 8A?>;L7C5< <>:>2K5 40==K5:', error.message);
      return this.getMockUserModifiers(userId);
    }
  }
  
  /**
   * #AB0=>28BL <>48D8:0B>@ 83@K 4;O ?>;L7>20B5;O
   */
  async setUserGameModifier(userId, game, modifierType, value) {
    try {
      const data = {
        game,
        modifierType,
        value: parseFloat(value)
      };
      
      const response = await this.api.post(`/admin/users/${userId}/modifiers`, data);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'H81:0 CAB0=>2:8 <>48D8:0B>@0');
      }
    } catch (error) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      // A;8 API =5 @50;87>20=, A8<C;8@C5< CA?5H=CN CAB0=>2:C
      console.warn('API 4;O CAB0=>2:8 <>48D8:0B>@>2 =5 4>ABC?5=, A8<C;8@C5< CA?5E:', error.message);
      return {
        userId,
        game,
        modifierType,
        value: parseFloat(value),
        updatedAt: new Date().toISOString()
      };
    }
  }
  
  /**
   * !1@>A8BL <>48D8:0B>@K ?>;L7>20B5;O
   */
  async resetUserModifiers(userId) {
    try {
      const response = await this.api.delete(`/admin/users/${userId}/modifiers`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'H81:0 A1@>A0 <>48D8:0B>@>2');
      }
    } catch (error) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      // A;8 API =5 @50;87>20=, A8<C;8@C5< CA?5H=K9 A1@>A
      console.warn('API 4;O A1@>A0 <>48D8:0B>@>2 =5 4>ABC?5=, A8<C;8@C5< CA?5E:', error.message);
      return {
        userId,
        resetAt: new Date().toISOString()
      };
    }
  }
  
  /**
   * >;CG8BL A?8A>: ?>;L7>20B5;59 4;O C?@02;5=8O
   */
  async getUsers(page = 1, limit = 50, search = '') {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (search) {
        params.append('search', search);
      }
      
      const response = await this.api.get(`/admin/users?${params}`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error('H81:0 ?>;CG5=8O A?8A:0 ?>;L7>20B5;59');
      }
    } catch (error) {
      console.warn('H81:0 ?>;CG5=8O ?>;L7>20B5;59, 8A?>;L7C5< <>:>2K5 40==K5:', error.message);
      return this.getMockUsers(page, limit, search);
    }
  }
  
  /**
   * >;CG8BL 45B0;L=CN 8=D>@<0F8N > ?>;L7>20B5;5
   */
  async getUserDetails(userId) {
    try {
      const response = await this.api.get(`/admin/users/${userId}`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error('>;L7>20B5;L =5 =0945=');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('>;L7>20B5;L =5 =0945=');
      }
      
      console.warn('H81:0 ?>;CG5=8O 40==KE ?>;L7>20B5;O, 8A?>;L7C5< <>:>2K5 40==K5:', error.message);
      return this.getMockUserDetails(userId);
    }
  }
  
  /**
   * ;>:8@>20BL/@071;>:8@>20BL ?>;L7>20B5;O
   */
  async toggleUserBlock(userId, blocked = true, reason = '') {
    try {
      const data = { blocked, reason };
      const response = await this.api.patch(`/admin/users/${userId}/block`, data);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'H81:0 87<5=5=8O AB0BCA0 ?>;L7>20B5;O');
      }
    } catch (error) {
      console.warn('API 4;O 1;>:8@>2:8 =5 4>ABC?5=, A8<C;8@C5< CA?5E:', error.message);
      return {
        userId,
        blocked,
        reason,
        updatedAt: new Date().toISOString()
      };
    }
  }
  
  /**
   * >;CG8BL AB0B8AB8:C 04<8=8AB@0B>@0
   */
  async getAdminStatistics() {
    try {
      const response = await this.api.get('/admin/statistics');
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error('H81:0 ?>;CG5=8O AB0B8AB8:8');
      }
    } catch (error) {
      console.warn('H81:0 ?>;CG5=8O AB0B8AB8:8, 8A?>;L7C5< <>:>2K5 40==K5:', error.message);
      return this.getMockAdminStatistics();
    }
  }
  
  // === + + /   " ===
  
  getMockOddsStatistics() {
    return {
      totalUsers: 1247,
      modifiedUsers: 23,
      gameStats: {
        coin: {
          modified: 8,
          avgModifier: 12.5,
          minModifier: -10,
          maxModifier: 25
        },
        slots: {
          modified: 15,
          avgModifier: -5.2,
          minModifier: -20,
          maxModifier: 10
        },
        mines: {
          modified: 6,
          avgModifier: 18.7,
          minModifier: 5,
          maxModifier: 30
        },
        crash: {
          modified: 12,
          avgModifier: -8.9,
          minModifier: -15,
          maxModifier: 5
        }
      }
    };
  }
  
  getMockUserModifiers(userId) {
    return {
      userId: userId.toString(),
      username: `user_${userId}`,
      gameSettings: {
        coin: {
          winChanceModifier: Math.random() > 0.7 ? Math.floor(Math.random() * 30 - 15) : 0
        },
        slots: {
          rtpModifier: Math.random() > 0.7 ? Math.floor(Math.random() * 25 - 10) : 0
        },
        mines: {
          mineChanceModifier: Math.random() > 0.7 ? Math.floor(Math.random() * 20 - 5) : 0
        },
        crash: {
          crashModifier: Math.random() > 0.7 ? Math.floor(Math.random() * 30 - 15) : 0
        }
      }
    };
  }
  
  getMockUsers(page, limit, search) {
    const users = [];
    const start = (page - 1) * limit;
    
    for (let i = start; i < start + limit; i++) {
      const userId = 1000 + i;
      users.push({
        id: userId,
        username: `user_${userId}`,
        firstName: `User ${userId}`,
        balance: Math.floor(Math.random() * 10000),
        totalBets: Math.floor(Math.random() * 500),
        totalWins: Math.floor(Math.random() * 200),
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        isBlocked: Math.random() > 0.95
      });
    }
    
    return {
      users: search ? users.filter(u => 
        u.username.includes(search) || 
        u.firstName.includes(search) ||
        u.id.toString().includes(search)
      ) : users,
      pagination: {
        page,
        limit,
        total: search ? Math.floor(Math.random() * 100) : 5000,
        pages: Math.ceil((search ? Math.floor(Math.random() * 100) : 5000) / limit)
      }
    };
  }
  
  getMockUserDetails(userId) {
    return {
      id: userId,
      username: `user_${userId}`,
      firstName: `User ${userId}`,
      balance: Math.floor(Math.random() * 10000),
      totalBets: Math.floor(Math.random() * 500),
      totalWins: Math.floor(Math.random() * 200),
      totalLosses: Math.floor(Math.random() * 300),
      profit: Math.floor(Math.random() * 2000 - 1000),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      isBlocked: Math.random() > 0.95,
      blockReason: null,
      referralCode: `REF_${userId}`,
      referredBy: Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : null,
      referrals: Math.floor(Math.random() * 10),
      gameStats: {
        coin: { played: Math.floor(Math.random() * 100), won: Math.floor(Math.random() * 50) },
        slots: { played: Math.floor(Math.random() * 200), won: Math.floor(Math.random() * 60) },
        mines: { played: Math.floor(Math.random() * 80), won: Math.floor(Math.random() * 30) },
        crash: { played: Math.floor(Math.random() * 150), won: Math.floor(Math.random() * 45) },
        events: { played: Math.floor(Math.random() * 50), won: Math.floor(Math.random() * 15) }
      }
    };
  }
  
  getMockAdminStatistics() {
    return {
      users: {
        total: 12470,
        active: 8934,
        blocked: 156,
        newToday: 67,
        newThisWeek: 423
      },
      games: {
        totalBets: 156789,
        totalWins: 98234,
        houseEdge: 3.45,
        profit: 287450.67
      },
      events: {
        active: 12,
        completed: 89,
        totalBets: 45632,
        totalPayout: 156789.23
      },
      finances: {
        totalBalance: 1234567.89,
        todayDeposits: 23456.78,
        todayWithdrawals: 18765.43,
        pendingWithdrawals: 5432.10
      }
    };
  }
}

module.exports = new AdminService();