'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const { ingestEvent } = require('../../services/transactionIngestionService');
const IngestionEvent = require('../../db/schemas/IngestionEvent');
const ProcessingQueueJob = require('../../db/schemas/ProcessingQueueJob');
const Transaction = require('../../db/schemas/Transaction');
const {
  verifyHmacSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  isFreshTimestamp,
} = require('../../utils/webhookSecurity');
const config = require('../../config');const logger = require('../../utils/logger').forModule('ingestionRoutes');const { adaptIncomingEvent } = require('../../services/sourceAdapters');

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

router.get(
  '/ingestion/summary',
  authenticate,
  requireRole('admin'),
  [query('hours').optional().isInt({ min: 1, max: 168 }).toInt()],
  validateRequest,
  async (req, res) => {
    const hours = req.query.hours || 24;
    const from = new Date(Date.now() - (hours * 60 * 60 * 1000));
    const [statusStats, sourceStats, recentFailures] = await Promise.all([
      IngestionEvent.aggregate([
        { $match: { receivedAt: { $gte: from } } },
        { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
      ]),
      IngestionEvent.aggregate([
        { $match: { receivedAt: { $gte: from } } },
        { $group: { _id: '$sourceSystem', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      IngestionEvent.find({ processingStatus: { $in: ['rejected', 'failed'] }, receivedAt: { $gte: from } })
        .sort({ receivedAt: -1 })
        .limit(30)
        .lean(),
    ]);
    res.json({
      success: true,
      data: {
        windowHours: hours,
        statusStats,
        sourceStats,
        recentFailures,
      },
    });
  }
);

router.post(
  '/ingestion/replay',
  authenticate,
  requireRole('admin'),
  [
    body('sourceSystem').optional().isString(),
    body('from').isISO8601(),
    body('to').isISO8601(),
    body('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  validateRequest,
  async (req, res) => {
    const from = new Date(req.body.from);
    const to = new Date(req.body.to);
    const limit = req.body.limit || 100;
    const filter = { receivedAt: { $gte: from, $lte: to }, processingStatus: { $in: ['accepted', 'rejected'] } };
    if (req.body.sourceSystem) filter.sourceSystem = req.body.sourceSystem;

    const events = await IngestionEvent.find(filter).sort({ receivedAt: -1 }).limit(limit).lean();
    const jobs = [];
    for (const event of events) {
      const jobId = `JOB-${uuidv4().slice(0, 10).toUpperCase()}`;
      const exists = await ProcessingQueueJob.findOne({ ingestId: event.ingestId, jobType: 'event_replay', status: { $in: ['pending', 'processing'] } }).lean();
      if (exists) continue;
      jobs.push({
        jobId,
        jobType: 'event_replay',
        source: 'admin_replay',
        txnId: event.normalizedTxnId,
        sourceSystem: event.sourceSystem,
        ingestId: event.ingestId,
        payload: event.rawPayload || {},
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: new Date(),
      });
    }
    if (jobs.length > 0) {
      await ProcessingQueueJob.insertMany(jobs, { ordered: false }).catch((insertErr) => logger.warn({ insertErr }, 'Failed to insert replay jobs (some may be duplicates)'));
    }
    res.json({ success: true, data: { queuedJobs: jobs.length, candidateEvents: events.length } });
  }
);

router.get(
  '/ingestion/replay/jobs',
  authenticate,
  requireRole('admin'),
  [query('limit').optional().isInt({ min: 1, max: 200 }).toInt()],
  validateRequest,
  async (req, res) => {
    const limit = req.query.limit || 50;
    const jobs = await ProcessingQueueJob.find({ jobType: { $in: ['event_replay', 'agent_process'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: jobs });
  }
);

router.post(
  '/ingestion/replay/jobs/:jobId/run',
  authenticate,
  requireRole('admin'),
  validateRequest,
  async (req, res) => {
    const job = await ProcessingQueueJob.findOne({ jobId: req.params.jobId });
    if (!job) return res.status(404).json({ success: false, error: 'Replay job not found' });

    if (job.txnId) {
      await Transaction.updateOne({ txnId: job.txnId }, { $set: { agentProcessed: false } });
    } else if (job.payload) {
      await ingestEvent({
        payload: job.payload,
        sourceType: 'batch',
        sourceSystem: job.sourceSystem || 'replay',
        externalEventId: job.ingestId || job.jobId,
        requestMeta: { actorId: req.user?.sub || 'admin-replay', ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      });
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
    return res.json({ success: true, data: { jobId: job.jobId, status: job.status } });
  }
);

/**
 * GET /api/v1/ingestion/monitor/health
 * Comprehensive ingestion health monitoring with per-source metrics
 */
router.get(
  '/ingestion/monitor/health',
  authenticate,
  requireRole('admin'),
  [query('hours').optional().isInt({ min: 1, max: 168 }).toInt()],
  validateRequest,
  async (req, res) => {
    try {
      const hours = req.query.hours || 24;
      const from = new Date(Date.now() - (hours * 60 * 60 * 1000));

      // Per-source metrics
      const sourceMetrics = await IngestionEvent.aggregate([
        { $match: { receivedAt: { $gte: from } } },
        {
          $group: {
            _id: '$sourceSystem',
            totalEvents: { $sum: 1 },
            acceptedCount: {
              $sum: { $cond: [{ $eq: ['$processingStatus', 'accepted'] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$processingStatus', 'rejected'] }, 1, 0] },
            },
            duplicateCount: {
              $sum: { $cond: [{ $eq: ['$processingStatus', 'duplicate'] }, 1, 0] },
            },
            apiSourceCount: {
              $sum: { $cond: [{ $eq: ['$sourceType', 'api'] }, 1, 0] },
            },
            webhookSourceCount: {
              $sum: { $cond: [{ $eq: ['$sourceType', 'webhook'] }, 1, 0] },
            },
            latestEventAt: { $max: '$receivedAt' },
            oldestEventAt: { $min: '$receivedAt' },
          },
        },
        { $sort: { totalEvents: -1 } },
      ]);

      // Add health status and error rates for each source
      const sourceHealthMetrics = sourceMetrics.map((source) => {
        const acceptanceRate = source.totalEvents > 0
          ? Math.round((source.acceptedCount / source.totalEvents) * 1000) / 10
          : 0;
        const errorRate = source.totalEvents > 0
          ? Math.round(((source.rejectedCount) / source.totalEvents) * 1000) / 10
          : 0;
        const healthScore = acceptanceRate >= 95 ? 'healthy' : acceptanceRate >= 80 ? 'degraded' : 'unhealthy';

        return {
          sourceSystem: source._id,
          totalEvents: source.totalEvents,
          acceptedCount: source.acceptedCount,
          rejectedCount: source.rejectedCount,
          duplicateCount: source.duplicateCount,
          acceptanceRate,
          errorRate,
          sourceTypes: {
            api: source.apiSourceCount,
            webhook: source.webhookSourceCount,
          },
          latestEventAt: source.latestEventAt,
          oldestEventAt: source.oldestEventAt,
          healthStatus: healthScore,
          throughputPerHour: Math.round(source.totalEvents / hours),
        };
      });

      // Overall ingestion health
      const allEvents = await IngestionEvent.countDocuments({ receivedAt: { $gte: from } });
      const accepted = await IngestionEvent.countDocuments({ processingStatus: 'accepted', receivedAt: { $gte: from } });
      const rejected = await IngestionEvent.countDocuments({ processingStatus: 'rejected', receivedAt: { $gte: from } });
      const overallAcceptanceRate = allEvents > 0 ? Math.round((accepted / allEvents) * 1000) / 10 : 0;

      res.json({
        success: true,
        data: {
          windowHours: hours,
          overallHealth: {
            totalEvents: allEvents,
            acceptedCount: accepted,
            rejectedCount: rejected,
            acceptanceRate: overallAcceptanceRate,
            healthStatus: overallAcceptanceRate >= 95 ? 'healthy' : overallAcceptanceRate >= 80 ? 'degraded' : 'unhealthy',
          },
          sourceMetrics: sourceHealthMetrics,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch ingestion health');
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/v1/ingestion/monitor/backlog
 * Monitor processing queue backlog and retry status
 */
router.get(
  '/ingestion/monitor/backlog',
  authenticate,
  requireRole('admin'),
  validateRequest,
  async (req, res) => {
    try {
      // Queue job status breakdown
      const queueStats = await ProcessingQueueJob.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgAttempts: { $avg: '$attempts' },
            maxAttempts: { $max: '$attempts' },
          },
        },
      ]);

      const queueByStatus = {};
      queueStats.forEach((stat) => {
        queueByStatus[stat._id] = {
          count: stat.count,
          avgAttempts: Math.round(stat.avgAttempts * 100) / 100,
          maxAttempts: stat.maxAttempts,
        };
      });

      // Pending jobs by source system
      const pendingBySource = await ProcessingQueueJob.aggregate([
        { $match: { status: 'pending' } },
        {
          $group: {
            _id: '$sourceSystem',
            count: { $sum: 1 },
            oldestJobAt: { $min: '$createdAt' },
          },
        },
        { $sort: { count: -1 } },
      ]);

      // Failed jobs that exceeded max attempts
      const deadLetterCount = await ProcessingQueueJob.countDocuments({
        status: 'dead_letter',
      });
      const failedCount = await ProcessingQueueJob.countDocuments({
        status: 'failed',
      });

      // Jobs scheduled for retry
      const retryCount = await ProcessingQueueJob.countDocuments({
        status: 'pending',
        nextAttemptAt: { $lte: new Date() },
      });

      // Future retries
      const futureRetries = await ProcessingQueueJob.countDocuments({
        status: 'pending',
        nextAttemptAt: { $gt: new Date() },
      });

      res.json({
        success: true,
        data: {
          queueStatus: queueByStatus,
          pendingBySource: pendingBySource.map((s) => ({
            sourceSystem: s._id,
            pendingCount: s.count,
            oldestJobAt: s.oldestJobAt,
            backlogAgeMinutes: Math.round((Date.now() - new Date(s.oldestJobAt).getTime()) / 1000 / 60),
          })),
          deadLetterCount,
          failedCount,
          readyForRetryCount: retryCount,
          futureRetryCount: futureRetries,
          totalBacklog: (queueByStatus.pending?.count || 0) + (queueByStatus.processing?.count || 0),
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch backlog metrics');
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/v1/ingestion/monitor/failures
 * Webhook and ingestion failure timeline
 */
router.get(
  '/ingestion/monitor/failures',
  authenticate,
  requireRole('admin'),
  [
    query('hours').optional().isInt({ min: 1, max: 168 }).toInt(),
    query('sourceSystem').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const hours = req.query.hours || 24;
      const sourceSystem = req.query.sourceSystem || null;
      const limit = req.query.limit || 100;
      const from = new Date(Date.now() - (hours * 60 * 60 * 1000));

      // Get rejected events with reasons
      const filter = {
        processingStatus: 'rejected',
        receivedAt: { $gte: from },
      };
      if (sourceSystem) filter.sourceSystem = sourceSystem;

      const failures = await IngestionEvent.find(filter)
        .sort({ receivedAt: -1 })
        .limit(limit)
        .select({
          ingestId: 1,
          sourceSystem: 1,
          sourceType: 1,
          rejectionReason: 1,
          receivedAt: 1,
          externalEventId: 1,
          externalTransactionId: 1,
          requestMeta: 1,
        })
        .lean();

      // Get failed queue jobs
      const failedJobs = await ProcessingQueueJob.find({
        $or: [{ status: 'failed' }, { status: 'dead_letter' }],
        createdAt: { $gte: from },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select({
          jobId: 1,
          jobType: 1,
          sourceSystem: 1,
          status: 1,
          attempts: 1,
          maxAttempts: 1,
          lastError: 1,
          createdAt: 1,
          completedAt: 1,
        })
        .lean();

      // Failure timeline by hour
      const failureTimeline = await IngestionEvent.aggregate([
        {
          $match: {
            processingStatus: 'rejected',
            receivedAt: { $gte: from },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$receivedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]);

      res.json({
        success: true,
        data: {
          windowHours: hours,
          ingestionFailures: failures.map((f) => ({
            ingestId: f.ingestId,
            sourceSystem: f.sourceSystem,
            sourceType: f.sourceType,
            reason: f.rejectionReason,
            receivedAt: f.receivedAt,
            externalEventId: f.externalEventId,
            externalTransactionId: f.externalTransactionId,
            requestorIp: f.requestMeta?.ipAddress,
          })),
          queueJobFailures: failedJobs.map((j) => ({
            jobId: j.jobId,
            jobType: j.jobType,
            sourceSystem: j.sourceSystem,
            status: j.status,
            attempts: j.attempts,
            maxAttempts: j.maxAttempts,
            lastError: j.lastError,
            createdAt: j.createdAt,
            completedAt: j.completedAt,
          })),
          failureTimeline: failureTimeline.map((t) => ({
            hour: t._id,
            failureCount: t.count,
          })),
          summary: {
            totalIngestFailures: failures.length,
            totalQueueFailures: failedJobs.length,
            timeRange: { from, to: new Date() },
          },
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch failure timeline');
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
