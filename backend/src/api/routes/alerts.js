'use strict';

const express = require('express');
const { query, param, body } = require('express-validator');
const { FraudAlert } = require('../../db/schemas/Fraud');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const logger = require('../../utils/logger').forModule('alertRoutes');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/alerts
 * List fraud alerts with filters.
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('status').optional().isIn(['open', 'acknowledged', 'resolved', 'false_positive']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 20;
      const skip  = (page - 1) * limit;
      const filter = {};

      if (req.query.severity) filter.severity = req.query.severity;
      if (req.query.status)   filter.status   = req.query.status;

      const [alerts, total] = await Promise.all([
        FraudAlert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FraudAlert.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: alerts,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/alerts/:alertId
 */
router.get(
  '/:alertId',
  [param('alertId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const alert = await FraudAlert.findOne({ alertId: req.params.alertId }).lean();
      if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
      res.json({ success: true, data: alert });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/alerts/:alertId/acknowledge
 */
router.patch(
  '/:alertId/acknowledge',
  [param('alertId').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const alert = await FraudAlert.findOneAndUpdate(
        { alertId: req.params.alertId, status: 'open' },
        {
          $set: {
            status:          'acknowledged',
            acknowledgedBy:  req.user?.sub || 'analyst',
            acknowledgedAt:  new Date(),
          },
        },
        { new: true }
      );

      if (!alert) return res.status(404).json({ success: false, error: 'Alert not found or already acknowledged' });

      logger.info({ alertId: alert.alertId, by: req.user?.sub }, 'Alert acknowledged');
      res.json({ success: true, data: { alertId: alert.alertId, status: alert.status } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/alerts/:alertId/resolve
 * Body: { outcome: 'confirmed_fraud' | 'false_positive' | 'inconclusive' }
 */
router.patch(
  '/:alertId/resolve',
  [
    param('alertId').isString().notEmpty(),
    body('outcome').isIn(['confirmed_fraud', 'false_positive', 'inconclusive']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const nextStatus = req.body.outcome === 'false_positive' ? 'false_positive' : 'resolved';

      const alert = await FraudAlert.findOneAndUpdate(
        { alertId: req.params.alertId, status: { $in: ['open', 'acknowledged'] } },
        {
          $set: {
            status:      nextStatus,
            resolvedBy:  req.user?.sub || 'analyst',
            resolvedAt:  new Date(),
          },
        },
        { new: true }
      );

      if (!alert) return res.status(404).json({ success: false, error: 'Alert not found or already resolved' });

      logger.info({ alertId: alert.alertId, outcome: req.body.outcome, status: alert.status }, 'Alert resolved');
      res.json({ success: true, data: { alertId: alert.alertId, status: alert.status } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
