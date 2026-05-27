'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { body, query, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../../db/schemas/Transaction');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const vectorService = require('../../services/vectorService');
const logger = require('../../utils/logger').forModule('txnRoutes');
const { ingestEvent } = require('../../services/transactionIngestionService');

const router = express.Router();

// All transaction routes require auth
router.use(authenticate);

function isBypassWithoutDb() {
  return process.env.BYPASS_AUTH === 'true'
    && process.env.NODE_ENV !== 'production'
    && mongoose.connection.readyState !== 1;
}

/**
 * GET /api/v1/transactions
 * List transactions with pagination and filters.
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isString(),
    query('minScore').optional().isFloat({ min: 0, max: 100 }).toFloat(),
    query('accountId').optional().isString(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      if (isBypassWithoutDb()) {
        return res.json({
          success: true,
          data: [],
          pagination: { total: 0, page: req.query.page || 1, limit: req.query.limit || 20, pages: 1 },
        });
      }

      const page      = req.query.page  || 1;
      const limit     = req.query.limit || 20;
      const skip      = (page - 1) * limit;
      const filter    = {};

      if (req.query.status)    filter.status    = req.query.status;
      if (req.query.accountId) filter.accountId = req.query.accountId;
      if (req.query.minScore)  filter.fraudScore = { $gte: req.query.minScore };

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(filter),
      ]);

      // Mask sensitive fields
      const safe = transactions.map((t) => {
        if (t.device?.ipAddress) t.device.ipAddress = t.device.ipAddress.replace(/\d+$/, 'xxx');
        delete t.rawPayload;
        return t;
      });

      res.json({
        success: true,
        data: safe,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/transactions/:txnId
 * Get a single transaction by txnId.
 */
router.get(
  '/:txnId',
  [param('txnId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      if (isBypassWithoutDb()) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      const txn = await Transaction.findOne({ txnId: req.params.txnId }).lean();
      if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });

      if (txn.device?.ipAddress) txn.device.ipAddress = txn.device.ipAddress.replace(/\d+$/, 'xxx');
      delete txn.rawPayload;

      res.json({ success: true, data: txn });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/transactions
 * Submit a new transaction manually (demo / webhook / test scenarios).
 * In production this would come from your payment system.
 */
router.post(
  '/',
  [
    body('transactionId').optional().isString(),
    body('userId').optional().isString(),
    body('accountId').isString().notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('type').optional().isIn(['debit', 'credit', 'transfer', 'withdrawal', 'purchase', 'wire']),
    body('channel').optional().isIn(['online', 'pos', 'atm', 'mobile', 'api', 'wire']),
    body('paymentMethod').optional().isString(),
    body('sourceSystem').optional().isString(),
    body('metadata').optional().isObject(),
    body('riskFlags').optional().isArray(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      if (isBypassWithoutDb()) {
        const txnId = `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;
        return res.status(201).json({ success: true, data: { txnId, status: 'pending' } });
      }

      const result = await ingestEvent({
        payload: {
          ...req.body,
          transactionId: req.body.transactionId || `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        },
        sourceType: 'api',
        sourceSystem: req.body.sourceSystem || 'legacy_transactions_api',
        externalEventId: req.body.eventId || req.body.transactionId,
        requestMeta: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          actorId: req.user?.sub,
        },
      });

      const txn = await Transaction.findOne({ txnId: result.normalizedTxnId });
      if (!txn) {
        return res.status(500).json({ success: false, error: 'Transaction persisted but could not be loaded' });
      }

      logger.info({ txnId: txn.txnId, amount: txn.amount }, 'Transaction submitted via API');
      await vectorService.persistTransactionEmbedding(txn);

      res.status(result.status === 'duplicate' ? 200 : 201).json({
        success: true,
        data: { txnId: txn.txnId, status: txn.status, ingestStatus: result.status, ingestId: result.ingestId },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
