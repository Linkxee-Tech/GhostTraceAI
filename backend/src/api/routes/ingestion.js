'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const { ingestEvent } = require('../../services/transactionIngestionService');
const IngestionEvent = require('../../db/schemas/IngestionEvent');
const {
  verifyHmacSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  isFreshTimestamp,
} = require('../../utils/webhookSecurity');
const config = require('../../config');
const { adaptIncomingEvent } = require('../../services/sourceAdapters');

const router = express.Router();

const EVENT_VALIDATION = [
  body('transactionId').optional().isString(),
  body('userId').optional().isString(),
  body('accountId').isString().notEmpty(),
  body('amount').isFloat({ min: 0.000001 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('timestamp').optional().isISO8601(),
  body('location').optional().isObject(),
  body('device').optional().isObject(),
  body('ipAddress').optional().isString(),
  body('merchant').optional().isObject(),
  body('channel').optional().isString(),
  body('paymentMethod').optional().isString(),
  body('sourceSystem').optional().isString(),
  body('metadata').optional().isObject(),
  body('riskFlags').optional().isArray(),
];

router.post(
  '/transactions/ingest',
  authenticate,
  EVENT_VALIDATION,
  validateRequest,
  async (req, res) => {
    try {
      const result = await ingestEvent({
        payload: req.body,
        sourceType: 'api',
        sourceSystem: req.body.sourceSystem || 'external_api',
        externalEventId: req.body.eventId || req.body.transactionId,
        requestMeta: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          actorId: req.user?.sub,
        },
      });
      return res.status(result.status === 'duplicate' ? 200 : 201).json({ success: true, data: result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/transactions/simulate',
  authenticate,
  requireRole('admin'),
  EVENT_VALIDATION,
  validateRequest,
  async (req, res) => {
    try {
      const result = await ingestEvent({
        payload: { ...req.body, sourceSystem: req.body.sourceSystem || 'simulation' },
        sourceType: 'simulate',
        sourceSystem: req.body.sourceSystem || 'simulation',
        externalEventId: req.body.eventId || req.body.transactionId,
        requestMeta: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          actorId: req.user?.sub,
        },
      });
      return res.status(result.status === 'duplicate' ? 200 : 201).json({ success: true, data: result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/transactions/ingest/batch',
  authenticate,
  requireRole('admin'),
  [body('events').isArray({ min: 1, max: 100 })],
  validateRequest,
  async (req, res) => {
    const results = [];
    for (const eventPayload of req.body.events) {
      try {
        const result = await ingestEvent({
          payload: eventPayload,
          sourceType: 'batch',
          sourceSystem: eventPayload.sourceSystem || 'batch_upload',
          externalEventId: eventPayload.eventId || eventPayload.transactionId,
          requestMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'], actorId: req.user?.sub },
        });
        results.push({ ok: true, ...result });
      } catch (err) {
        results.push({ ok: false, error: err.message, externalEventId: eventPayload.eventId || eventPayload.transactionId });
      }
    }
    return res.json({ success: true, data: { total: results.length, results } });
  }
);

router.post('/webhooks/payments', async (req, res) => {
  try {
    const provider = String(req.headers['x-webhook-provider'] || 'generic').toLowerCase();
    const signature = req.headers['x-gt-signature'];
    const stripeSignature = req.headers['stripe-signature'];
    const paystackSignature = req.headers['x-paystack-signature'];
    const timestamp = req.headers['x-gt-timestamp'];
    const eventId = req.headers['x-gt-event-id'];
    const sourceSystem = String(req.headers['x-source-system'] || provider || 'payment_webhook');
    const rawBody = req.rawBody || JSON.stringify(req.body || {});

    let verified = false;
    if (provider === 'stripe') {
      verified = verifyStripeSignature({
        rawBody,
        stripeSignatureHeader: stripeSignature,
        secret: config.webhooks.stripeSigningSecret,
        toleranceSec: config.webhooks.signatureToleranceSec,
      });
    } else if (provider === 'paystack') {
      verified = verifyPaystackSignature({
        rawBody,
        signatureHeader: paystackSignature,
        secret: config.webhooks.paystackSigningSecret,
      });
    } else {
      if (!isFreshTimestamp(timestamp, config.webhooks.signatureToleranceSec)) {
        return res.status(401).json({ success: false, error: 'Stale webhook timestamp' });
      }
      verified = verifyHmacSignature({
        rawBody,
        timestamp,
        signatureHeader: signature,
        secret: config.webhooks.signingSecret || process.env.MCP_AUTH_SECRET,
      });
    }

    if (!verified) {
      return res.status(401).json({ success: false, error: `Invalid ${provider} webhook signature` });
    }

    const canonicalPayload = adaptIncomingEvent({ provider, payload: req.body, sourceSystem });
    const result = await ingestEvent({
      payload: canonicalPayload,
      sourceType: 'webhook',
      sourceSystem,
      externalEventId: eventId || req.body.eventId || req.body.transactionId,
      requestMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'], actorId: 'webhook' },
    });
    return res.status(result.status === 'duplicate' ? 200 : 201).json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get(
  '/ingestion/events',
  authenticate,
  requireRole('admin'),
  [query('limit').optional().isInt({ min: 1, max: 200 }).toInt()],
  validateRequest,
  async (req, res) => {
    const limit = req.query.limit || 50;
    const events = await IngestionEvent.find().sort({ receivedAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: events });
  }
);

module.exports = router;
