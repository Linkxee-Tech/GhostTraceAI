'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('./schemas/Transaction');
const { AuditLog } = require('./schemas/Fraud');
const logger = require('../utils/logger').forModule('changeStream');
const config = require('../config');

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

let streamInstance = null;
let isRunning = false;
let reconnectAttempts = 0;
let onTransactionCallback = null;

/**
 * Build the change stream pipeline.
 * Only triggers on insert and updates where agentProcessed = false.
 */
function buildPipeline() {
  return [
    {
      $match: {
        $or: [
          { operationType: 'insert' },
          {
            operationType: 'update',
            'updateDescription.updatedFields.status': { $exists: true },
            'fullDocument.agentProcessed': false,
          },
        ],
      },
    },
    {
      $project: {
        operationType: 1,
        fullDocument: 1,
        documentKey: 1,
        'updateDescription.updatedFields': 1,
        clusterTime: 1,
      },
    },
  ];
}

/**
 * Deduplicate events using a simple in-memory set (last 5 minutes of txnIds).
 * Prevents double-processing on stream resume.
 */
const processedIds = new Set();
setInterval(() => processedIds.clear(), 5 * 60 * 1000);

async function handleChangeEvent(change) {
  const doc = change.fullDocument;
  if (!doc) {
    logger.debug({ operationType: change.operationType }, 'Change event without fullDocument — skipping');
    return;
  }

  // Deduplication guard
  if (processedIds.has(doc.txnId)) {
    logger.debug({ txnId: doc.txnId }, 'Duplicate event — already processed');
    return;
  }
  processedIds.add(doc.txnId);

  // Skip already-processed transactions
  if (doc.agentProcessed) {
    logger.debug({ txnId: doc.txnId }, 'Transaction already processed by agent');
    return;
  }

  logger.info({ txnId: doc.txnId, operationType: change.operationType, amount: doc.amount },
    'New transaction event received from change stream');

  // Write audit log entry
  await AuditLog.create({
    auditId: uuidv4(),
    eventType: 'transaction_received',
    txnId: doc.txnId,
    accountId: doc.accountId,
    actorType: 'system',
    action: 'change_stream_received',
    details: {
      operationType: change.operationType,
      amount: doc.amount,
      currency: doc.currency,
    },
    success: true,
  }).catch((err) => logger.error({ err }, 'Failed to write audit log'));

  // Invoke agent pipeline callback
  if (onTransactionCallback) {
    try {
      await onTransactionCallback(doc);
    } catch (err) {
      logger.error({ err, txnId: doc.txnId }, 'Agent callback failed');
    }
  }
}

/**
 * Start the MongoDB Change Stream.
 * @param {Function} callback - async (transactionDoc) => void
 */
async function startChangeStream(callback) {
  if (isRunning) {
    logger.warn('Change stream already running');
    return;
  }

  onTransactionCallback = callback;
  isRunning = true;
  reconnectAttempts = 0;

  await openStream();
}

async function openStream() {
  try {
    const pipeline = buildPipeline();
    const options = {
      fullDocument: config.mongodb.changeStreamFullDoc,
      resumeAfter: global.__changeStreamResumeToken || undefined,
    };

    streamInstance = Transaction.watch(pipeline, options);

    streamInstance.on('change', async (change) => {
      // Store resume token for recovery
      global.__changeStreamResumeToken = change._id;
      await handleChangeEvent(change);
    });

    streamInstance.on('error', async (err) => {
      logger.error({ err }, 'Change stream error');
      await reconnect();
    });

    streamInstance.on('close', () => {
      logger.warn('Change stream closed');
      if (isRunning) reconnect();
    });

    reconnectAttempts = 0;
    logger.info('MongoDB change stream started successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to open change stream');
    await reconnect();
  }
}

async function reconnect() {
  if (!isRunning) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — change stream stopped`);
    isRunning = false;
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY_MS * reconnectAttempts;
  logger.info({ attempt: reconnectAttempts, delayMs: delay }, 'Reconnecting change stream...');

  await new Promise((r) => setTimeout(r, delay));

  if (streamInstance) {
    try { await streamInstance.close(); } catch (_) {}
  }

  await openStream();
}

async function stopChangeStream() {
  isRunning = false;
  if (streamInstance) {
    await streamInstance.close();
    streamInstance = null;
    logger.info('Change stream stopped');
  }
}

function isActive() {
  return isRunning && streamInstance !== null;
}

module.exports = { startChangeStream, stopChangeStream, isActive };
