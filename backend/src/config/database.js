// backend/src/config/database.js
const mongoose = require('mongoose');

/**
 * >=D83C@0F8O MongoDB ?>4:;NG5=8O
 */
const databaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight',
  options: {
    // 0AB@>9:8 ?>4:;NG5=8O 4;O production
    maxPoolSize: 10, // 0:A8<C< 10 A>548=5=89 2 ?C;5
    serverSelectionTimeoutMS: 5000, // "09<0CB 2K1>@0 A5@25@0
    socketTimeoutMS: 45000, // "09<0CB A>:5B0
    bufferMaxEntries: 0, // B:;NG8BL 1CD5@870F8N
    
    // 0AB@>9:8 4;O AB018;L=>AB8
    retryWrites: true,
    w: 'majority',
    
    // 0AB@>9:8 heartbeat
    heartbeatFrequencyMS: 10000,
    
    // 0AB@>9:8 4;O >1;0G=KE ?;0BD>@<
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
};

/**
 * >4:;NG5=85 : MongoDB A >1@01>B:>9 >H81>:
 */
async function connectToDatabase() {
  try {
    await mongoose.connect(databaseConfig.uri, databaseConfig.options);
    console.log(' Successfully connected to MongoDB');
    
    // 1@01>BG8:8 A>1KB89 ?>4:;NG5=8O
    mongoose.connection.on('error', (error) => {
      console.error('L MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('  MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('= MongoDB reconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('= MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('L Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

/**
 * @>25@:0 A>AB>O=8O ?>4:;NG5=8O
 */
function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[mongoose.connection.readyState],
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
}

module.exports = {
  connectToDatabase,
  getConnectionStatus,
  databaseConfig
};