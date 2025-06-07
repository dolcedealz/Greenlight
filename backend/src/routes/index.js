// backend/src/routes/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const gameRoutes = require('./game.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const paymentRoutes = require('./payment.routes');
const withdrawalRoutes = require('./withdrawal.routes');
const referralRoutes = require('./referral.routes');
const authRoutes = require('./auth.routes');
const webhookRoutes = require('./webhook.routes');
const eventRoutes = require('./event.routes');
const duelRoutes = require('./duel.routes');
const promocodeRoutes = require('./promocode.routes');
const adminPromocodeRoutes = require('./admin-promocode.routes');
const adminReferralRoutes = require('./admin-referral.routes');

const router = express.Router();

// Префиксы для маршрутов
router.use('/games', gameRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/referrals', referralRoutes);
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/events', eventRoutes);
router.use('/duels', duelRoutes);
router.use('/promocodes', promocodeRoutes);
router.use('/admin/promocodes', adminPromocodeRoutes);
router.use('/admin/referral', adminReferralRoutes);

// Health check endpoint with detailed status
router.get('/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { createLogger } = require('../utils/logger');
    const logger = createLogger('HEALTH_CHECK');
    
    const startTime = Date.now();
    
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const dbLatency = mongoose.connection.readyState === 1 ? await checkDbLatency() : null;
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };
    
    // Check uptime
    const uptimeSeconds = process.uptime();
    const uptime = {
      seconds: Math.floor(uptimeSeconds),
      formatted: formatUptime(uptimeSeconds)
    };
    
    // Check environment
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: process.env.NODE_ENV || 'development'
    };
    
    const health = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      environment,
      database: {
        status: dbStatus,
        latency: dbLatency
      },
      memory: memoryUsageMB,
      uptime,
      services: {
        games: 'operational',
        users: 'operational',
        admin: 'operational',
        payments: 'operational',
        withdrawals: 'operational',
        referrals: 'operational',
        auth: 'operational',
        events: 'operational',
        duels: 'operational',
        promocodes: 'operational',
        websocket: 'operational'
      }
    };
    
    // Log health check (only in development or if status is unhealthy)
    if (process.env.NODE_ENV !== 'production' || dbStatus !== 'connected') {
      logger.info('Health check performed', {
        status: health.status,
        dbStatus,
        responseTime: health.responseTime,
        memoryUsed: memoryUsageMB.heapUsed
      });
    }
    
    res.status(200).json(health);
    
  } catch (error) {
    const { createLogger } = require('../utils/logger');
    const logger = createLogger('HEALTH_CHECK');
    
    logger.error('Health check failed', error);
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// Helper function to check database latency
async function checkDbLatency() {
  try {
    const mongoose = require('mongoose');
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
  } catch (error) {
    return null;
  }
}

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

module.exports = router;
