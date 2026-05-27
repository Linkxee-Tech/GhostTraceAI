'use strict';

const express = require('express');
const { query, param, body } = require('express-validator');
const { AgentAction, AnalystReview, ModelExplanation } = require('../../db/schemas/Fraud');
const Transaction = require('../../db/schemas/Transaction');
const { processTransaction } = require('../../agent/fraudAgent');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const logger = require('../../utils/logger').forModule('agentRoutes');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/agent/actions
 * List all agent actions.
 */
router.get(
  '/actions',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('actionType').optional().isString(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const page   = req.query.page   || 1;
      const limit  = req.query.limit  || 20;
      const skip   = (page - 1) * limit;
      const filter = {};
      if (req.query.actionType) filter.actionType = req.query.actionType;

      const [actions, total] = await Promise.all([
        AgentAction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        AgentAction.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: actions,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/agent/explanations/:txnId
 * Get Gemini explanation for a specific transaction.
 */
router.get(
  '/explanations/:txnId',
  [param('txnId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const explanation = await ModelExplanation.findOne({ txnId: req.params.txnId })
        .sort({ createdAt: -1 })
        .lean();

      if (!explanation) {
        return res.status(404).json({ success: false, error: 'No explanation found for this transaction' });
      }
      const parsed = explanation.parsedOutput || {};
      res.json({
        success: true,
        data: {
          transactionId: req.params.txnId,
          riskScore: parsed.riskScore ?? parsed.fraudScore ?? null,
          fraudCategory: parsed.fraudCategory || null,
          confidence: parsed.confidence ?? null,
          recommendedAction: parsed.recommendedAction || null,
          reasoning: parsed.reasoning || [],
          explanation: parsed.explanation || '',
          anomalies: parsed.anomalies || [],
          latencyMs: explanation.latencyMs,
          fallbackUsed: explanation.fallbackUsed,
          createdAt: explanation.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/analysis/:transactionId
 * Unified analysis contract endpoint.
 */
router.get(
  '/analysis/:transactionId',
  [param('transactionId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const explanation = await ModelExplanation.findOne({ txnId: req.params.transactionId })
        .sort({ createdAt: -1 })
        .lean();
      if (!explanation) {
        return res.status(404).json({ success: false, error: 'No analysis found for this transaction' });
      }

      const parsed = explanation.parsedOutput || {};
      return res.json({
        success: true,
        data: {
          transactionId: req.params.transactionId,
          riskScore: parsed.riskScore ?? parsed.fraudScore ?? null,
          fraudCategory: parsed.fraudCategory || null,
          confidence: parsed.confidence ?? null,
          recommendedAction: parsed.recommendedAction || null,
          reasoning: parsed.reasoning || [],
          explanation: parsed.explanation || '',
          anomalies: parsed.anomalies || [],
          latencyMs: explanation.latencyMs,
          fallbackUsed: explanation.fallbackUsed,
          createdAt: explanation.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/agent/reprocess/:txnId
 * Manually trigger the agent to reprocess a specific transaction.
 */
router.post(
  '/reprocess/:txnId',
  [param('txnId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const txn = await Transaction.findOne({ txnId: req.params.txnId }).lean();
      if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });

      // Reset agentProcessed to allow reprocessing
      await Transaction.updateOne({ txnId: txn.txnId }, { $set: { agentProcessed: false } });

      logger.info({ txnId: txn.txnId, by: req.user?.sub }, 'Manual reprocess triggered');

      // Run async — don't block the response
      processTransaction({ ...txn, agentProcessed: false }, null).catch((err) =>
        logger.error({ err, txnId: txn.txnId }, 'Manual reprocess failed')
      );

      res.json({ success: true, data: { txnId: txn.txnId, message: 'Reprocessing started' } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Analyst Reviews ───────────────────────────────────────────

/**
 * GET /api/v1/agent/reviews
 */
router.get(
  '/reviews',
  [
    query('status').optional().isIn(['pending', 'in_progress', 'completed', 'escalated']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.status)   filter.status   = req.query.status;
      if (req.query.priority) filter.priority = req.query.priority;

      const reviews = await AnalystReview.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.json({ success: true, data: reviews });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/agent/reviews/:reviewId
 * Submit analyst decision on a review.
 * Body: { outcome, analystNotes }
 */
router.patch(
  '/reviews/:reviewId',
  [
    param('reviewId').isString().notEmpty(),
    body('outcome').isIn(['confirmed_fraud', 'false_positive', 'inconclusive']),
    body('analystNotes').optional().isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const now = new Date();
      const review = await AnalystReview.findOne({ reviewId: req.params.reviewId });
      if (!review) return res.status(404).json({ success: false, error: 'Review not found' });

      const timeToReviewMs = review.createdAt
        ? now - new Date(review.createdAt)
        : null;

      await AnalystReview.updateOne(
        { reviewId: req.params.reviewId },
        {
          $set: {
            status:         'completed',
            outcome:        req.body.outcome,
            analystNotes:   req.body.analystNotes,
            completedAt:    now,
            completedBy:    req.user?.sub || 'analyst',
            timeToReviewMs,
            slaBreached:    review.slaDeadline && now > new Date(review.slaDeadline),
          },
        }
      );

      // Update transaction review outcome
      if (review.txnId) {
        await Transaction.updateOne(
          { txnId: review.txnId },
          {
            $set: {
              reviewOutcome: req.body.outcome,
              reviewedBy:    req.user?.sub,
              reviewedAt:    now,
              status:        req.body.outcome === 'confirmed_fraud' ? 'rejected' : 'approved',
            },
          }
        );
      }

      logger.info({ reviewId: req.params.reviewId, outcome: req.body.outcome, by: req.user?.sub }, 'Review submitted');
      res.json({ success: true, data: { reviewId: req.params.reviewId, outcome: req.body.outcome } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
