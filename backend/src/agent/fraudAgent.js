'use strict';

const { v4: uuidv4 } = require('uuid');
const { analyzeFraud } = require('../services/geminiService');
const { computePreScores } = require('./riskScorer');
const { executeAction } = require('./actionExecutor');
const { AuditLog } = require('../db/schemas/Fraud');
const Transaction = require('../db/schemas/Transaction');
const vectorService = require('../services/vectorService');
const logger = require('../utils/logger').forModule('fraudAgent');

// Track in-flight transactions to prevent concurrent double-processing
const inFlight = new Set();

/**
 * Write structured audit log for agent reasoning lifecycle events.
 */
async function auditEvent(eventType, txnId, accountId, details = {}, success = true) {
  return AuditLog.create({
    auditId: uuidv4(),
    eventType,
    txnId,
    accountId,
    actorType: 'agent',
    details,
    success,
    latencyMs: details.latencyMs,
    errorMessage: details.error,
  }).catch((err) => logger.error({ err }, 'Audit log write failed'));
}

/**
 * Agent lifecycle: prepare, analyze, act.
 *
 * 1. compute risk factors
 * 2. analyze with the fraud model
 * 3. apply the chosen action
 */
async function processTransaction(txn, broadcastFn) {
  // Guard: skip if already in-flight
  if (inFlight.has(txn.txnId)) {
    logger.debug({ txnId: txn.txnId }, 'Already in-flight — skipping');
    return;
  }

  inFlight.add(txn.txnId);
  const pipelineStart = Date.now();
  let lockAcquired = false;

  try {
    // Attempt to acquire a DB-level lock to prevent concurrent processing
    const lock = await Transaction.findOneAndUpdate(
      { txnId: txn.txnId, agentLock: { $ne: true } },
      { $set: { agentLock: true } },
      { new: true }
    ).lean();

    if (!lock) {
      logger.debug({ txnId: txn.txnId }, 'Another worker holds lock — skipping processing');
      return;
    }

    lockAcquired = true;

    logger.info({ txnId: txn.txnId, accountId: txn.accountId, amount: txn.amount }, 'Agent pipeline started');

    await auditEvent('agent_reasoning_start', txn.txnId, txn.accountId);

    // Broadcast: agent started processing this transaction
    if (broadcastFn) {
      broadcastFn('agent:reasoning', {
        txnId: txn.txnId,
        stage: 'planning',
        message: 'Computing risk factors...',
      });
    }

    // ── PHASE 1: PLAN ──────────────────────────────────────
    // Skip expensive Gemini call for very low-risk transactions
    const quickPreScore = await computePreScores(txn).catch((err) => {
      logger.error({ err }, 'Pre-score computation failed');
      return null;
    });

    if (!quickPreScore) {
      logger.warn({ txnId: txn.txnId }, 'Pre-score failed — using rule-based only');
    }

    await vectorService.persistTransactionEmbedding(txn).catch((err) => {
      logger.warn({ err, txnId: txn.txnId }, 'Unable to generate embedding for transaction');
    });

    // Fast-path: if pre-score is very low, auto-clear without Gemini
    if (quickPreScore && quickPreScore.preScore < 15) {
      logger.info({ txnId: txn.txnId, preScore: quickPreScore.preScore },
        'Fast-path clear (pre-score < 15) — skipping Gemini');

      await Transaction.findOneAndUpdate(
        { txnId: txn.txnId },
        {
          $set: {
            status: 'cleared',
            agentProcessed: true,
            agentProcessedAt: new Date(),
            fraudScore: quickPreScore.preScore,
            fraudConfidence: 0.95,
            isFraud: false,
            agentAction: 'clear',
            agentActionAt: new Date(),
          },
        }
      );

      if (broadcastFn) {
        broadcastFn('transaction:update', {
          txnId: txn.txnId,
          accountId: txn.accountId,
          status: 'cleared',
          fraudScore: quickPreScore.preScore,
          action: 'clear',
          timestamp: new Date().toISOString(),
        });
      }

      await auditEvent('action_executed', txn.txnId, txn.accountId, {
        action: 'clear',
        reason: 'fast_path_low_risk',
        fraudScore: quickPreScore.preScore,
        latencyMs: Date.now() - pipelineStart,
      });

      return { action: 'clear', fraudScore: quickPreScore.preScore, fastPath: true };
    }

    // ── PHASE 2: REASON ────────────────────────────────────
    if (broadcastFn) {
      broadcastFn('agent:reasoning', {
        txnId: txn.txnId,
        stage: 'reasoning',
        message: 'Analyzing fraud risk...',
        preScore: quickPreScore?.preScore,
      });
    }

    const reasonStart = Date.now();
    const analysisResult = await analyzeFraud(
      txn,
      quickPreScore?.velocityData,
      {
        behavioralDrift: quickPreScore?.behaviorData,
        geoAnomaly: quickPreScore?.geoData,
        deviceTrust: quickPreScore?.deviceData,
        merchantRisk: quickPreScore?.merchantData,
      }
    );

    await auditEvent('agent_reasoning_complete', txn.txnId, txn.accountId, {
      fraudScore: analysisResult.fraudScore,
      confidence: analysisResult.confidence,
      recommendedAction: analysisResult.recommendedAction,
      fallbackUsed: analysisResult.fallbackUsed,
      latencyMs: Date.now() - reasonStart,
    });

    logger.info({
      txnId: txn.txnId,
      fraudScore: analysisResult.fraudScore,
      confidence: analysisResult.confidence,
      action: analysisResult.recommendedAction,
      fallbackUsed: analysisResult.fallbackUsed,
    }, 'Reasoning complete');

    // ── PHASE 3: ACT ───────────────────────────────────────
    if (broadcastFn) {
      broadcastFn('agent:reasoning', {
        txnId: txn.txnId,
        stage: 'acting',
        message: `Executing: ${analysisResult.recommendedAction}`,
        fraudScore: analysisResult.fraudScore,
      });
    }

    const actionResult = await executeAction(
      txn,
      analysisResult,
      quickPreScore || {},
      broadcastFn
    );

    const totalLatencyMs = Date.now() - pipelineStart;

    logger.info({
      txnId: txn.txnId,
      totalLatencyMs,
      action: actionResult.action,
      fraudScore: analysisResult.fraudScore,
    }, 'Agent pipeline complete');

    return {
      action: actionResult.action,
      fraudScore: analysisResult.fraudScore,
      confidence: analysisResult.confidence,
      explanation: analysisResult.explanation,
      alertId: actionResult.alert?.alertId,
      reviewId: actionResult.review?.reviewId,
      totalLatencyMs,
      fastPath: false,
    };

  } catch (err) {
    logger.error({ err, txnId: txn.txnId }, 'Agent pipeline failed');

    await auditEvent('stream_error', txn.txnId, txn.accountId, {
      error: err.message,
      latencyMs: Date.now() - pipelineStart,
    }, false).catch((auditErr) => logger.warn({ auditErr }, 'Failed to write stream_error audit log'));

    // Safety net: mark as review_required if pipeline fails
    await Transaction.findOneAndUpdate(
      { txnId: txn.txnId },
      {
        $set: {
          status: 'under_review',
          agentProcessed: true,
          agentProcessedAt: new Date(),
          reviewRequired: true,
          agentAction: 'request_review',
          agentActionAt: new Date(),
        },
      }
    ).catch((updateErr) => logger.warn({ updateErr, txnId: txn.txnId }, 'Failed to mark transaction under_review'));

    if (broadcastFn) {
      broadcastFn('agent:error', { txnId: txn.txnId, error: 'Pipeline error — queued for review' });
    }

    return { action: 'request_review', error: err.message };

  } finally {
    // release DB lock if held
    try {
      if (lockAcquired) {
        await Transaction.findOneAndUpdate({ txnId: txn.txnId }, { $set: { agentLock: false } }).catch((releaseErr) => logger.warn({ releaseErr, txnId: txn.txnId }, 'Failed to release agentLock'));
      }
    } catch (e) {
      logger.warn({ err: e }, 'Failed to release agentLock');
    }

    inFlight.delete(txn.txnId);
  }
}

/**
 * Batch reprocess unprocessed transactions on startup.
 * Catches any transactions that were inserted while the agent was down.
 */
async function reprocessPendingTransactions(broadcastFn) {
  const pending = await Transaction.find({
    agentProcessed: false,
    status: 'pending',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
    .limit(50)
    .sort({ createdAt: 1 })
    .lean();

  if (!pending.length) {
    logger.info('No pending transactions to reprocess');
    return;
  }

  logger.info({ count: pending.length }, 'Reprocessing pending transactions');

  // Process sequentially to avoid overwhelming Gemini API
  for (const txn of pending) {
    await processTransaction(txn, broadcastFn);
    await new Promise((r) => setTimeout(r, 100)); // 100ms between calls
  }
}

module.exports = { processTransaction, reprocessPendingTransactions };
