// backend/src/services/auth.service.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * !5@28A 0CB5=B8D8:0F88 4;O Telegram Mini App
 */
class AuthService {
  /**
   * 0;840F8O 40==KE Telegram WebApp
   * @param {string} initData - 0==K5 8=8F80;870F88 >B Telegram
   * @param {string} botToken - ">:5= 1>B0
   * @returns {Object|null} - 0==K5 ?>;L7>20B5;O 8;8 null 5A;8 =520;84=>
   */
  validateTelegramWebAppData(initData, botToken) {
    try {
      console.log('= AUTH SERVICE: 0;840F8O Telegram WebApp 40==KE');
      
      if (!initData || !botToken) {
        console.error('L AUTH SERVICE: BACBAB2CNB initData 8;8 botToken');
        return null;
      }

      // 0@A8< 40==K5 87 initData
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        console.error('L AUTH SERVICE: BACBAB2C5B hash 2 initData');
        return null;
      }

      // #18@05< hash 87 ?0@0<5B@>2 4;O 20;840F88
      urlParams.delete('hash');
      
      // !>@B8@C5< ?0@0<5B@K 8 A>7405< AB@>:C 4;O 20;840F88
      const dataCheckArray = [];
      for (const [key, value] of urlParams.entries()) {
        dataCheckArray.push(`${key}=${value}`);
      }
      dataCheckArray.sort();
      const dataCheckString = dataCheckArray.join('\n');

      // !>7405< A5:@5B=K9 :;NG 87 B>:5=0 1>B0
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // KG8A;O5< >68405<K9 hash
      const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // @>25@O5< hash
      if (hash !== expectedHash) {
        console.error('L AUTH SERVICE: 520;84=K9 hash');
        return null;
      }

      // 0@A8< 40==K5 ?>;L7>20B5;O
      const userDataString = urlParams.get('user');
      if (!userDataString) {
        console.error('L AUTH SERVICE: BACBAB2CNB 40==K5 ?>;L7>20B5;O');
        return null;
      }

      const userData = JSON.parse(userDataString);
      
      // @>25@O5< auth_date (40==K5 =5 4>;6=K 1KBL AB0@H5 24 G0A>2)
      const authDate = parseInt(urlParams.get('auth_date'));
      const currentTime = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 G0A0 2 A5:C=40E

      if (currentTime - authDate > maxAge) {
        console.error('L AUTH SERVICE: 0==K5 02B>@870F88 CAB0@5;8');
        return null;
      }

      console.log(' AUTH SERVICE: Telegram 40==K5 20;84=K');
      return {
        telegramId: userData.id,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        languageCode: userData.language_code,
        authDate: new Date(authDate * 1000),
        queryId: urlParams.get('query_id'),
        chatType: urlParams.get('chat_type'),
        chatInstance: urlParams.get('chat_instance')
      };

    } catch (error) {
      console.error('L AUTH SERVICE: H81:0 20;840F88 Telegram 40==KE:', error);
      return null;
    }
  }

  /**
   * >;CG8BL 8;8 A>740BL ?>;L7>20B5;O ?> Telegram 40==K<
   * @param {Object} telegramData - 0;848@>20==K5 40==K5 Telegram
   * @param {string} referralCode -  5D5@0;L=K9 :>4 (>?F8>=0;L=>)
   * @returns {Promise<Object>} - >;L7>20B5;L
   */
  async getOrCreateUser(telegramData, referralCode = null) {
    try {
      console.log(`= AUTH SERVICE: >8A: ?>;L7>20B5;O A Telegram ID: ${telegramData.telegramId}`);
      
      let user = await User.findOne({ telegramId: telegramData.telegramId });
      
      if (user) {
        // 1=>2;O5< 40==K5 ACI5AB2CNI53> ?>;L7>20B5;O
        user.username = telegramData.username || user.username;
        user.firstName = telegramData.firstName || user.firstName;
        user.lastName = telegramData.lastName || user.lastName;
        user.languageCode = telegramData.languageCode || user.languageCode;
        user.lastActivity = new Date();
        
        await user.save();
        console.log(` AUTH SERVICE: >;L7>20B5;L >1=>2;5=: ${user.username || user.telegramId}`);
        
        return user;
      }

      // !>7405< =>2>3> ?>;L7>20B5;O
      console.log(`=d AUTH SERVICE: !>740=85 =>2>3> ?>;L7>20B5;O`);
      
      const newUserData = {
        telegramId: telegramData.telegramId,
        username: telegramData.username,
        firstName: telegramData.firstName,
        lastName: telegramData.lastName,
        languageCode: telegramData.languageCode,
        balance: 0,
        totalWagered: 0,
        totalWon: 0,
        isBlocked: false,
        registeredAt: new Date(),
        lastActivity: new Date(),
        // 0AB@>9:8 ?> C<>;G0=8N
        settings: {
          soundEnabled: true,
          vibrationEnabled: true,
          notifications: true
        }
      };

      // 1@010BK205< @5D5@0;L=K9 :>4
      if (referralCode) {
        try {
          const referrer = await User.findOne({ 
            referralCode: referralCode,
            isBlocked: false 
          });
          
          if (referrer && referrer.telegramId !== telegramData.telegramId) {
            newUserData.referredBy = referrer._id;
            console.log(`=e AUTH SERVICE: >;L7>20B5;L ?@83;0H5= ?> @5D5@0;L=><C :>4C: ${referralCode}`);
          }
        } catch (refError) {
          console.error('  AUTH SERVICE: H81:0 >1@01>B:8 @5D5@0;L=>3> :>40:', refError);
          // 5 ?@5@K205< A>740=85 ?>;L7>20B5;O 87-70 >H81:8 2 @5D5@0;L=>9 A8AB5<5
        }
      }

      user = new User(newUserData);
      await user.save();

      console.log(` AUTH SERVICE: >2K9 ?>;L7>20B5;L A>740=: ${user.username || user.telegramId}`);
      return user;

    } catch (error) {
      console.error('L AUTH SERVICE: H81:0 A>740=8O/?>;CG5=8O ?>;L7>20B5;O:', error);
      throw new Error('H81:0 0CB5=B8D8:0F88 ?>;L7>20B5;O');
    }
  }

  /**
   * !>740BL JWT B>:5= 4;O ?>;L7>20B5;O
   * @param {Object} user - >;L7>20B5;L
   * @returns {string} - JWT B>:5=
   */
  generateJWT(user) {
    try {
      const payload = {
        userId: user._id,
        telegramId: user.telegramId,
        username: user.username,
        isBlocked: user.isBlocked
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'default-secret-key',
        { 
          expiresIn: '30d',
          issuer: 'greenlight-casino',
          audience: 'telegram-mini-app'
        }
      );

      console.log(`= AUTH SERVICE: JWT B>:5= A>740= 4;O ?>;L7>20B5;O: ${user.username || user.telegramId}`);
      return token;

    } catch (error) {
      console.error('L AUTH SERVICE: H81:0 A>740=8O JWT B>:5=0:', error);
      throw new Error('H81:0 A>740=8O B>:5=0');
    }
  }

  /**
   * 0;848@>20BL JWT B>:5=
   * @param {string} token - JWT B>:5=
   * @returns {Object|null} - 5:>48@>20==K5 40==K5 8;8 null
   */
  validateJWT(token) {
    try {
      if (!token) {
        return null;
      }

      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'default-secret-key',
        {
          issuer: 'greenlight-casino',
          audience: 'telegram-mini-app'
        }
      );

      return decoded;

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.warn('  AUTH SERVICE: JWT B>:5= 8AB5:');
      } else if (error.name === 'JsonWebTokenError') {
        console.warn('  AUTH SERVICE: 520;84=K9 JWT B>:5=');
      } else {
        console.error('L AUTH SERVICE: H81:0 20;840F88 JWT:', error);
      }
      return null;
    }
  }

  /**
   * @>25@8BL ?@020 04<8=8AB@0B>@0
   * @param {Object} user - >;L7>20B5;L
   * @returns {boolean} - /2;O5BAO ;8 04<8=8AB@0B>@><
   */
  isAdmin(user) {
    if (!user || !user.telegramId) {
      return false;
    }

    // !?8A>: 04<8=>2 87 ?5@5<5==KE >:@C65=8O
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim());
    return adminIds.includes(user.telegramId.toString());
  }

  /**
   * >;=0O 0CB5=B8D8:0F8O ?>;L7>20B5;O 4;O Telegram Mini App
   * @param {string} initData - 0==K5 8=8F80;870F88 >B Telegram
   * @param {string} referralCode -  5D5@0;L=K9 :>4 (>?F8>=0;L=>)
   * @returns {Promise<Object>} -  57C;LB0B 0CB5=B8D8:0F88
   */
  async authenticateUser(initData, referralCode = null) {
    try {
      console.log('=€ AUTH SERVICE: 0G0;> 0CB5=B8D8:0F88 ?>;L7>20B5;O');

      // 0;848@C5< Telegram 40==K5
      const telegramData = this.validateTelegramWebAppData(
        initData,
        process.env.TELEGRAM_BOT_TOKEN
      );

      if (!telegramData) {
        throw new Error('520;84=K5 40==K5 Telegram');
      }

      // >;CG05< 8;8 A>7405< ?>;L7>20B5;O
      const user = await this.getOrCreateUser(telegramData, referralCode);

      // @>25@O5<, =5 701;>:8@>20= ;8 ?>;L7>20B5;L
      if (user.isBlocked) {
        throw new Error('>;L7>20B5;L 701;>:8@>20=');
      }

      // !>7405< JWT B>:5=
      const token = this.generateJWT(user);

      console.log(' AUTH SERVICE: CB5=B8D8:0F8O CA?5H=0');

      return {
        success: true,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          balance: user.balance,
          totalWagered: user.totalWagered,
          totalWon: user.totalWon,
          referralCode: user.referralCode,
          isAdmin: this.isAdmin(user),
          registeredAt: user.registeredAt,
          lastActivity: user.lastActivity
        },
        token
      };

    } catch (error) {
      console.error('L AUTH SERVICE: H81:0 0CB5=B8D8:0F88:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new AuthService();