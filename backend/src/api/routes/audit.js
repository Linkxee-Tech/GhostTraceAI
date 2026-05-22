'use strict';

const express = require('express');
const { query, param } = require('express-validator');
const { AuditLog } = require('../../db/schemas/Fraud');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/audit
 * List audit log entries with filters.
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('txnId').optional().isString(),
    query('eventType').optional().isString(),
    query('actorType').optional().isIn(['agent', 'analyst', 'system', 'api']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 50;
      const skip  = (page - 1) * limit;
      const filter = {};

      if (req.query.txnId)     filter.txnId     = req.query.txnId;
      if (req.query.eventType) filter.eventType = req.query.eventType;
      if (req.query.actorType) filter.actorType = req.query.actorType;

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/audit/transaction/:txnId
 * Get the complete audit trail for one transaction.
 */
router.get(
  '/transaction/:txnId',
  [param('txnId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const logs = await AuditLog.find({ txnId: req.params.txnId })
        .sort({ createdAt: 1 })
        .select('-__v')
        .lean();

      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
