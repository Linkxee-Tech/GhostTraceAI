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

    if (config.app.seedDefaultUsers) {
      try {
        const { seeded, users, reason } = await require('./services/authService').seedDefaultUsers();
        if (seeded) {
          logger.info({ users }, 'Seeded default user accounts');
        } else {
          logger.info({ reason }, 'Skipped seeding default users');
        }
      } catch (seedErr) {
        logger.warn({ err: seedErr }, 'Failed to seed default users');
      }
    }

    logger.info('MongoDB connected — starting MCP server, change stream and agent pipeline');

    // Start MCP server after DB connection so tools have DB access
    try {
      await startMcpServer();
      logger.info('MCP server started successfully after DB connect');
    } catch (mcpErr) {
      logger.warn({ err: mcpErr }, 'Failed to start MCP server after DB connect — continuing');
    }

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

  // NOTE: MCP server will be started after MongoDB is connected (see connectWithRetry)

  // ── 4. Start HTTP server immediately ──────────────────────
  // Optionally wait for DB to be ready before listening. This can be
  // enabled in environments where accepting requests before DB is
  // undesirable (set WAIT_FOR_DB=true). Default behavior is to start
  // the HTTP server immediately and connect to MongoDB in background.
  if (config.app.waitForDb) {
    logger.info('WAIT_FOR_DB enabled — attempting to connect to MongoDB before listening');
    await connect();
    logger.info('MongoDB connected — proceeding to start HTTP server');
  }

  await new Promise((resolve, reject) => {
    server.listen(config.app.port, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  logger.info(
    { port: config.app.port, env: config.app.env },
    `GhostTrace AI HTTP server running on port ${config.app.port}`
  );

  // Start DB connect in background if we didn't wait for it above
  const broadcastFn = (event, data) => broadcast(event, data);
  if (!config.app.waitForDb) {
    connectWithRetry(broadcastFn);
  } else {
    // If we waited successfully, still initialize change streams and agent
    try {
      await startChangeStream(async (txnDoc) => {
        await processTransaction(txnDoc, broadcastFn);
      });
      await reprocessPendingTransactions(broadcastFn);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to initialize change stream after waiting for DB — falling back to background retry');
      connectWithRetry(broadcastFn);
    }
  }
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
