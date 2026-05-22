'use strict';

const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger').forModule('db');

let isConnected = false;
let connectionPromise = null;

/**
 * Connect to MongoDB Atlas with retry logic.
 * Returns the mongoose connection.
 */
async function connect() {
  if (isConnected) return mongoose.connection;

  // Deduplicate concurrent connect() calls
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    logger.info({ uri: config.mongodb.uri.replace(/:\/\/[^@]+@/, '://*****@') },
      'Connecting to MongoDB Atlas...');

    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      isConnected = true;
      logger.info('MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — will attempt reconnect');
      isConnected = false;
      connectionPromise = null;
    });

    await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
      ...config.mongodb.options,
    });

    return mongoose.connection;
  })();

  return connectionPromise;
}

async function disconnect() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  connectionPromise = null;
  logger.info('MongoDB disconnected gracefully');
}

function getDb() {
  if (!isConnected) throw new Error('MongoDB not connected. Call connect() first.');
  return mongoose.connection.db;
}

/**
 * Health check — returns connection state and latency.
 */
async function healthCheck() {
  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
      state: mongoose.connection.readyState,
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      error: err.message,
      state: mongoose.connection.readyState,
    };
  }
}

module.exports = { connect, disconnect, getDb, healthCheck };
