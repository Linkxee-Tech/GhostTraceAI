'use strict';

const { v4: uuidv4 } = require('uuid');
const Transaction = require('../db/schemas/Transaction');
const { FraudAlert, AuditLog, AgentAction, AnalystReview } = require('../db/schemas/Fraud');
const notificationService = require('../services/notificationService');
const config = require('../config');
const logger = require('../utils/logger').forModule('actionExecutor');

/**
 * Map Gemini recommendation to transaction status
 */
const ACTION_TO_STATUS = {
  clear: 'cleared',
  flag: 'flagged',
  block: 'blocked',
  freeze: 'frozen',
  escalate: 'blocked',
  request_review: 'under_review',
};

/**
 * Map fraud score to alert severity
 */
function scoreToSeverity(score) {
  if (score >= 90) return 'critical';
  if (score >= 80) return 'high';
  if (score >= 65) return 'medium';
  return 'low';
}

/**
 * Create an immutable audit log entry for any action.
 */
async function writeAuditLog(params) {
  return AuditLog.create({
    auditId: uuidv4(),
    ...params,
  }).catch((err) => logger.error({ err }, 'Audit log write failed'));
}

/**
 * Create a FraudAlert record.
 */
async function createAlert(txn, analysisResult, preScores) {
  const alertId = `ALT-${uuidv4().slice(0, 8).toUpperCase()}`;

  const alert = await FraudAlert.create({
    alertId,
    txnId: txn.txnId,
    accountId: txn.accountId,
    severity: scoreToSeverity(analysisResult.fraudScore),
    status: 'open',
    fraudScore: analysisResult.fraudScore,
    fraudConfidence: analysisResult.confidence,
    triggerReasons: analysisResult.anomalies || [],
    geminiExplanation: analysisResult.explanation,
    riskFactors: {
      velocityScore: preScores.velocityData?.velocityScore || 0,
      geoAnomalyScore: preScores.geoData?.geoAnomalyScore || 0,
      deviceTrustScore: preScores.deviceData?.deviceTrustScore || 0,
      merchantRiskScore: preScores.merchantData?.merchantRiskScore || 0,
      behavioralDriftScore: preScores.behaviorData?.behavioralDriftScore || 0,
    },
    agentAction: analysisResult.recommendedAction,
    agentActionAt: new Date(),
  });

  logger.info({ alertId, txnId: txn.txnId, severity: alert.severity }, 'Fraud alert created');
  return alert;
}

/**
 * Request human analyst review for borderline cases.
 */
async function createReviewRequest(txn, alert, analysisResult) {
  const reviewId = `REV-${uuidv4().slice(0, 8).toUpperCase()}`;
  const slaMinutes = analysisResult.fraudScore >= 80 ? 15 : 60;

  const review = await AnalystReview.create({
    reviewId,
    txnId: txn.txnId,
    alertId: alert.alertId,
    priority: analysisResult.fraudScore >= 80 ? 'urgent' : 'high',
    status: 'pending',
    slaDeadline: new Date(Date.now() + slaMinutes * 60 * 1000),
    agentRecommendation: analysisResult.recommendedAction,
    agentScore: analysisResult.fraudScore,
  });

  logger.info({ reviewId, txnId: txn.txnId }, 'Review request created');
  return review;
}

/**
 * Record the agent action in the AgentActions collection.
 */
async function recordAgentAction(txn, actionType, analysisResult, executionLatencyMs) {
  const actionId = `ACT-${uuidv4().slice(0, 8).toUpperCase()}`;

  return AgentAction.create({
    actionId,
    txnId: txn.txnId,
    accountId: txn.accountId,
    actionType,
    status: 'executed',
    fraudScoreAtAction: analysisResult.fraudScore,
    confidenceAtAction: analysisResult.confidence,
    reasoning: analysisResult.explanation,
    executedAt: new Date(),
    executionLatencyMs,
    metadata: {
      riskFactors: analysisResult.riskFactors,
      anomalies: analysisResult.anomalies,
      fallbackUsed: analysisResult.fallbackUsed,
    },
  });
}

async function invokeExternalEnforcement(txn, effectiveAction, analysisResult) {
  if (!config.enforcement.webhookUrl) return null;
  if (!['block', 'freeze', 'escalate'].includes(effectiveAction)) return null;

  const payload = {
    txnId: txn.txnId,
    accountId: txn.accountId,
    amount: txn.amount,
    currency: txn.currency,
    action: effectiveAction,
    fraudScore: analysisResult.fraudScore,
    confidence: analysisResult.confidence,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const headers = { 'Content-Type': 'application/json' };
    if (config.enforcement.webhookSecret) {
      headers['x-enforcement-secret'] = config.enforcement.webhookSecret;
    }

    const response = await fetch(config.enforcement.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Enforcement webhook failed: ${response.status} ${text}`);
    }

    logger.info({ txnId: txn.txnId, action: effectiveAction }, 'External enforcement webhook invoked');
    return response;
  } catch (err) {
    logger.warn({ err, txnId: txn.txnId, action: effectiveAction }, 'External enforcement webhook failed');
    return null;
  }
}

/**
 * Main action execution function.
 * This is called by the agent orchestrator after Gemini analysis.
 *
 * @param {Object} txn - The transaction document
 * @param {Object} analysisResult - Gemini analysis output
 * @param {Object} preScores - Pre-computed risk scores
 * @param {Function} broadcastFn - WebSocket broadcast function
 */
async function executeAction(txn, analysisResult, preScores, broadcastFn) {
  const actionStartTime = Date.now();
  const action = analysisResult.recommendedAction;

  logger.info({ txnId: txn.txnId, action, fraudScore: analysisResult.fraudScore },
    'Executing agent action');

  // Enforce minimum confidence — if below threshold, downgrade to review
  const effectiveAction = analysisResult.confidence < config.agent.minConfidence
    ? 'request_review'
    : action;

  const effectiveStatus = ACTION_TO_STATUS[effectiveAction] || 'under_review';

  // ── Step 1: Update transaction status atomically ──────────
  await Transaction.findOneAndUpdate(
    { txnId: txn.txnId, agentProcessed: false }, // Prevent double-processing
    {
      $set: {
        status: effectiveStatus,
        agentProcessed: true,
        agentProcessedAt: new Date(),
        fraudScore: analysisResult.fraudScore,
        fraudConfidence: analysisResult.confidence,
        isFraud: analysisResult.isFraud,
        fraudReasons: analysisResult.anomalies || [],
        agentAction: effectiveAction,
        agentActionAt: new Date(),
        reviewRequired: ['request_review', 'escalate'].includes(effectiveAction),
        velocityCount1min: preScores.velocityData?.count1min || 0,
        velocityCount5min: preScores.velocityData?.count5min || 0,
        velocityCount1hr: preScores.velocityData?.count1hr || 0,
      },
    },
    { new: true }
  );

  const executionLatencyMs = Date.now() - actionStartTime;

  // ── Step 2: Create fraud alert for anything flagged+ ──────
  let alert = null;
  if (analysisResult.fraudScore >= config.agent.flagThreshold) {
    alert = await createAlert(txn, analysisResult, preScores);
  }

  // ── Step 3: Create analyst review for ambiguous cases ─────
  let review = null;
  if (['request_review', 'escalate'].includes(effectiveAction) && alert) {
    review = await createReviewRequest(txn, alert, analysisResult);
  }

  // ── Step 4: Record the agent action ───────────────────────
  const agentAction = await recordAgentAction(txn, effectiveAction, analysisResult, executionLatencyMs);

  // ── Step 5: Write audit log ───────────────────────────────
  await writeAuditLog({
    eventType: 'action_executed',
    txnId: txn.txnId,
    accountId: txn.accountId,
    actorType: 'agent',
    action: effectiveAction,
    details: {
      fraudScore: analysisResult.fraudScore,
      confidence: analysisResult.confidence,
      previousAction: action,
      effectiveAction,
      confidenceDowngrade: action !== effectiveAction,
    },
    latencyMs: executionLatencyMs,
    success: true,
  });

  // ── Step 6: Invoke optional external enforcement webhook ──
  await invokeExternalEnforcement(txn, effectiveAction, analysisResult);

  // ── Step 7: Send notifications for high-risk events ───────
  if (analysisResult.fraudScore >= config.agent.blockThreshold && alert) {
    await notificationService.sendHighRiskAlert({
      txn,
      alert,
      analysisResult,
    }).catch((err) => logger.error({ err }, 'Notification failed — continuing'));
  }

  // ── Step 8: Broadcast to WebSocket clients ────────────────
  if (broadcastFn) {
    broadcastFn('transaction:update', {
      txnId: txn.txnId,
      accountId: txn.accountId,
      status: effectiveStatus,
      fraudScore: analysisResult.fraudScore,
      action: effectiveAction,
      explanation: analysisResult.explanation,
      alertId: alert?.alertId,
      reviewId: review?.reviewId,
      riskFactors: {
        velocityScore: preScores.velocityData?.velocityScore || 0,
        geoAnomalyScore: preScores.geoData?.geoAnomalyScore || 0,
        deviceTrustScore: preScores.deviceData?.deviceTrustScore || 0,
        merchantRiskScore: preScores.merchantData?.merchantRiskScore || 0,
        behavioralDriftScore: preScores.behaviorData?.behavioralDriftScore || 0,
      },
      timestamp: new Date().toISOString(),
    });
  }

  logger.info({
    txnId: txn.txnId,
    effectiveAction,
    fraudScore: analysisResult.fraudScore,
    executionLatencyMs,
    alertCreated: !!alert,
    reviewCreated: !!review,
  }, 'Action execution complete');

  return {
    action: effectiveAction,
    status: effectiveStatus,
    alert,
    review,
    agentAction,
    executionLatencyMs,
  };
}

module.exports = { executeAction };
