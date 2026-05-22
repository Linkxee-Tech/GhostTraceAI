'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../../db/schemas/Transaction');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const vectorService = require('../../services/vectorService');
const logger = require('../../utils/logger').forModule('txnRoutes');

const router = express.Router();

// All transaction routes require auth
router.use(authenticate);

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
    body('accountId').isString().notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('type').isIn(['debit', 'credit', 'transfer', 'withdrawal', 'purchase', 'wire']),
    body('channel').optional().isIn(['online', 'pos', 'atm', 'mobile', 'api', 'wire']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const txnId = `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;

      const txn = await Transaction.create({
        txnId,
        accountId:  req.body.accountId,
        userId:     req.body.userId,
        amount:     req.body.amount,
        currency:   req.body.currency   || 'USD',
        type:       req.body.type,
        channel:    req.body.channel    || 'api',
        merchant:   req.body.merchant,
        device:     req.body.device,
        geo:        req.body.geo,
        rawPayload: req.body,
        status:     'pending',
      });

      logger.info({ txnId, amount: txn.amount }, 'Transaction submitted via API');

      // Persist vector embeddings for this transaction so Atlas vector search can be used immediately.
      await vectorService.persistTransactionEmbedding(txn);

      // The change stream will automatically pick this up and process it
      res.status(201).json({ success: true, data: { txnId: txn.txnId, status: txn.status } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
