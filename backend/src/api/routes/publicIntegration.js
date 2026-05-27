'use strict';

const express = require('express');
const { param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const { FraudAlert, ModelExplanation } = require('../../db/schemas/Fraud');

const router = express.Router();

router.use(authenticate);

router.get('/fraud/alerts', async (req, res) => {
  const alerts = await FraudAlert.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: alerts });
});

router.get(
  '/analysis/:transactionId',
  [param('transactionId').isString().notEmpty()],
  validateRequest,
  async (req, res) => {
    const explanation = await ModelExplanation.findOne({ txnId: req.params.transactionId })
      .sort({ createdAt: -1 })
      .lean();
    if (!explanation) return res.status(404).json({ success: false, error: 'No analysis found' });

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
      },
    });
  }
);

module.exports = router;

