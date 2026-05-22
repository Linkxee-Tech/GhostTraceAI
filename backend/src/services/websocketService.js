'use strict';

const { Server } = require('socket.io');
const { verifyToken, verifyApiKey } = require('../services/authService');
const config = require('../config');
const logger = require('../utils/logger').forModule('websocket');

let io = null;

/**
 * Initialize Socket.io on the HTTP server.
 * Called once from src/index.js after the HTTP server starts.
 */
function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      config.app.corsOrigins,
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: config.websocket.pingInterval,
    pingTimeout:  config.websocket.pingTimeout,
    transports:   ['websocket', 'polling'],
  });

  // ── Auth middleware ────────────────────────────────────────
  io.use((socket, next) => {
    // Dev bypass
    if (process.env.BYPASS_AUTH === 'true' && !config.app.isProd) {
      socket.user = { sub: 'dev-user', role: 'analyst' };
      return next();
    }

    const token  = socket.handshake.auth?.token;
    const apiKey = socket.handshake.headers?.['x-api-key'];

    if (token) {
      try {
        socket.user = verifyToken(token);
        return next();
      } catch {
        return next(new Error('Invalid token'));
      }
    }

    if (apiKey && verifyApiKey(apiKey)) {
      socket.user = { sub: 'api-user', role: 'analyst' };
      return next();
    }

    // Allow unauthenticated connections to receive public events (demo mode)
    socket.user = { sub: 'anonymous', role: 'viewer' };
    next();
  });

  // ── Connection handler ─────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, user: socket.user?.sub }, 'WebSocket client connected');

    // Join role-based room
    socket.join('dashboard');
    if (socket.user?.role !== 'viewer') socket.join('analysts');

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'WebSocket client disconnected');
    });

    socket.on('error', (err) => {
      logger.error({ err, socketId: socket.id }, 'Socket error');
    });

    // Client can subscribe to a specific account's events
    socket.on('subscribe:account', (accountId) => {
      if (typeof accountId === 'string' && accountId.length < 50) {
        socket.join(`account:${accountId}`);
        logger.debug({ socketId: socket.id, accountId }, 'Subscribed to account');
      }
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Broadcast an event to all connected dashboard clients.
 * Safe to call before WebSocket is initialized (no-op).
 */
function broadcast(event, data) {
  if (!io) return;
  io.to('dashboard').emit(event, data);
}

/**
 * Broadcast to analysts only (excludes anonymous viewers).
 */
function broadcastToAnalysts(event, data) {
  if (!io) return;
  io.to('analysts').emit(event, data);
}

/**
 * Send to a specific account room.
 */
function broadcastToAccount(accountId, event, data) {
  if (!io) return;
  io.to(`account:${accountId}`).emit(event, data);
}

/**
 * Get current connection count.
 */
async function getConnectionCount() {
  if (!io) return 0;
  const sockets = await io.fetchSockets();
  return sockets.length;
}

module.exports = { initWebSocket, broadcast, broadcastToAnalysts, broadcastToAccount, getConnectionCount };
