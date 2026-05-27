'use strict';

const http = require('http');
const createApp = require('./app');
const { connect, disconnect } = require('./db/connection');
const { startChangeStream, stopChangeStream } = require('./db/changeStream');
const { processTransaction, reprocessPendingTransactions } = require('./agent/fraudAgent');
const { initWebSocket, broadcast } = require('./services/websocketService');
const { startMcpServer, stopMcpServer } = require('./mcp/mcpServer');
const config = require('./config');
const logger = require('./utils/logger').forModule('server');

let server = null;

async function connectWithRetry(broadcastFn, attempt = 1) {
  try {
    await connect();

    logger.info('MongoDB connected — starting change stream and agent pipeline');

    await startChangeStream(async (txnDoc) => {
      await processTransaction(txnDoc, broadcastFn);
    });

    await reprocessPendingTransactions(broadcastFn);
  } catch (err) {
    const delayMs = Math.min(5000 * attempt, 30000);
    logger.warn({ err: err.message, attempt, nextRetryMs: delayMs },
      'MongoDB connection failed — retrying in background...');
    setTimeout(() => connectWithRetry(broadcastFn, attempt + 1), delayMs);
  }
}

async function start() {
  logger.info('Starting GhostTrace AI backend…');

  // ── 1. Create Express app and HTTP server ─────────────────
  // NOTE: We start the HTTP server BEFORE connecting to MongoDB.
  // This allows the server to accept requests immediately and
  // self-heal when the DB becomes available.
  const app = createApp();
  server = http.createServer(app);

  // ── 2. Initialize WebSocket ────────────────────────────────
  initWebSocket(server);

  // ── 3. Start MCP server ────────────────────────────────────
  await startMcpServer().catch((err) => {
    logger.warn({ err: err.message }, 'MCP server failed to start — continuing without MCP');
  });

  // ── 4. Start HTTP server immediately ──────────────────────
  await new Promise((resolve) => server.listen(config.app.port, resolve));

  logger.info(
    { port: config.app.port, env: config.app.env },
    `GhostTrace AI HTTP server running on port ${config.app.port}`
  );

  // ── 5. Connect to MongoDB in background with retries ──────
  const broadcastFn = (event, data) => broadcast(event, data);
  connectWithRetry(broadcastFn);
}

// ── Graceful shutdown ─────────────────────────────────────────
async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }

    // Stop change stream first to prevent new work
    await stopChangeStream();

    // Stop MCP server and transport
    await stopMcpServer();

    // Close MongoDB
    await disconnect();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Unhandled rejection safety net
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  if (config.app.isProd) shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
