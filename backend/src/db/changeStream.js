'use strict';

const { v4: uuidv4 } = require('uuid');
const Transaction = require('./schemas/Transaction');
const { AuditLog } = require('./schemas/Fraud');
const ProcessingQueueJob = require('./schemas/ProcessingQueueJob');
const logger = require('../utils/logger').forModule('changeStream');
const config = require('../config');

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 10000;

let streamInstance = null;
let isRunning = false;
let reconnectAttempts = 0;
let onTransactionCallback = null;
let queueWorkerInterval = null;
let pollWorkerInterval = null;

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
      await ProcessingQueueJob.updateMany(
        { txnId: doc.txnId, status: { $in: ['pending', 'failed', 'processing'] }, jobType: 'agent_process' },
        { $set: { status: 'completed', completedAt: new Date() } }
      );
    } catch (err) {
      logger.error({ err, txnId: doc.txnId }, 'Agent callback failed');
      await enqueueFailedAgentJob(doc, `agent_callback_failed:${err.message}`);
    }
  }
}

async function enqueueFailedAgentJob(doc, message) {
  const existing = await ProcessingQueueJob.findOne({
    txnId: doc.txnId,
    jobType: 'agent_process',
    status: { $in: ['pending', 'processing', 'failed'] },
  });
  if (existing) return;
  await ProcessingQueueJob.create({
    jobId: `JOB-${uuidv4().slice(0, 10).toUpperCase()}`,
    jobType: 'agent_process',
    source: 'change_stream',
    txnId: doc.txnId,
    sourceSystem: doc.sourceSystem || 'unknown',
    payload: doc,
    status: 'pending',
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: new Date(Date.now() + 15 * 1000),
    lastError: message,
  });
}

async function processQueueJobs() {
  if (!onTransactionCallback) return;
  const jobs = await ProcessingQueueJob.find({
    status: { $in: ['pending', 'failed'] },
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(20);

  for (const job of jobs) {
    try {
      job.status = 'processing';
      job.attempts += 1;
      await job.save();
      await onTransactionCallback(job.payload);
      job.status = 'completed';
      job.completedAt = new Date();
      job.lastError = undefined;
      await job.save();
    } catch (err) {
      const dead = job.attempts >= job.maxAttempts;
      job.status = dead ? 'dead_letter' : 'failed';
      job.lastError = err.message;
      const backoffMs = Math.min(60000, 5000 * job.attempts);
      job.nextAttemptAt = new Date(Date.now() + backoffMs);
      await job.save();

      await AuditLog.create({
        auditId: uuidv4(),
        eventType: 'stream_error',
        txnId: job.txnId,
        accountId: job.payload?.accountId,
        actorType: 'system',
        action: dead ? 'queue_dead_letter' : 'queue_retry_scheduled',
        details: { jobId: job.jobId, attempts: job.attempts, maxAttempts: job.maxAttempts },
        success: false,
        errorMessage: err.message,
      }).catch((auditErr) => logger.error({ auditErr }, 'Failed to write stream_error audit log'));
    }
  }
}

async function processPendingTransactions() {
  if (!onTransactionCallback) return;
  const pending = await Transaction.find({ agentProcessed: false, status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  if (!pending.length) return;
  logger.info({ count: pending.length }, 'Polling pending transactions for processing');

  for (const txn of pending) {
    try {
      await onTransactionCallback(txn);
    } catch (err) {
      logger.error({ err, txnId: txn.txnId }, 'Polling fallback transaction processing failed');
      await enqueueFailedAgentJob(txn, `poll_fallback_failed:${err.message}`);
    }
  }
}

function isChangeStreamUnsupported(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('change stream') && (message.includes('replica set') || message.includes('not supported') || message.includes('not a replica set'));
}

function startPollingPendingTransactions() {
  if (pollWorkerInterval) return;
  pollWorkerInterval = setInterval(() => {
    processPendingTransactions().catch((err) => logger.error({ err }, 'Pending transaction poll failed'));
  }, POLL_INTERVAL_MS);
}

function stopPollingPendingTransactions() {
  if (!pollWorkerInterval) return;
  clearInterval(pollWorkerInterval);
  pollWorkerInterval = null;
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
  if (!queueWorkerInterval) {
    queueWorkerInterval = setInterval(() => {
      processQueueJobs().catch((err) => logger.error({ err }, 'Queue worker failure'));
    }, 10000);
  }
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
    if (isChangeStreamUnsupported(err)) {
      logger.warn('MongoDB change streams are unsupported by this server. Enabling polling fallback to process pending transactions.');
      startPollingPendingTransactions();
      return;
    }
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
    try { await streamInstance.close(); } catch (_err) { /* ignore close errors during reconnect */ }
  }

  await openStream();
}

async function stopChangeStream() {
  isRunning = false;
  if (queueWorkerInterval) {
    clearInterval(queueWorkerInterval);
    queueWorkerInterval = null;
  }
  stopPollingPendingTransactions();
  if (streamInstance) {
    await streamInstance.close();
    streamInstance = null;
    logger.info('Change stream stopped');
  }
}

function isActive() {
  return isRunning && streamInstance !== null;
}

function getStatus() {
  return {
    active: isActive(),
    reconnectAttempts,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  };
}

module.exports = { startChangeStream, stopChangeStream, isActive, getStatus };
