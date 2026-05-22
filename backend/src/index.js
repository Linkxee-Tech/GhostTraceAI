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

async function start() {
  logger.info('Starting GhostTrace AI backend…');

  // ── 1. Connect to MongoDB ─────────────────────────────────
  await connect();

  // ── 2. Create Express app and HTTP server ─────────────────
  const app = createApp();
  server = http.createServer(app);

  // ── 3. Initialize WebSocket on the same HTTP server ───────
  initWebSocket(server);

  // ── 4. Start MCP server for GCAB / MCP tool integration ─────
  await startMcpServer();

  // ── 5. Start MongoDB Change Stream ────────────────────────
  //    Pass a broadcast callback so the agent can push WS events
  const broadcastFn = (event, data) => broadcast(event, data);

  await startChangeStream(async (txnDoc) => {
    // This fires for every new/updated transaction
    await processTransaction(txnDoc, broadcastFn);
  });

  // ── 5. Reprocess any transactions missed while offline ─────
  await reprocessPendingTransactions(broadcastFn);

  // ── 6. Start HTTP server ───────────────────────────────────
  await new Promise((resolve) => server.listen(config.app.port, resolve));

  logger.info(
    {
      port:     config.app.port,
      env:      config.app.env,
      mongoDb:  config.mongodb.dbName,
    },
    `GhostTrace AI running on port ${config.app.port}`
  );
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
