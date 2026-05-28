'use strict';

const crypto = require('crypto');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, query, param } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const ComplianceReportSnapshot = require('../../db/schemas/ComplianceReportSnapshot');
const ComplianceReportSchedule = require('../../db/schemas/ComplianceReportSchedule');
const IngestionEvent = require('../../db/schemas/IngestionEvent');
const ProcessingQueueJob = require('../../db/schemas/ProcessingQueueJob');
const { FraudAlert, AuditLog } = require('../../db/schemas/Fraud');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

router.post(
  '/compliance/snapshots',
  [body('periodStart').isISO8601(), body('periodEnd').isISO8601()],
  validateRequest,
  async (req, res) => {
    const periodStart = new Date(req.body.periodStart);
    const periodEnd = new Date(req.body.periodEnd);
    if (periodEnd <= periodStart) {
      return res.status(400).json({ success: false, error: 'periodEnd must be after periodStart' });
    }

    const [ingestionSummary, queueSummary, alertSummary, auditSummary] = await Promise.all([
      IngestionEvent.aggregate([
        { $match: { receivedAt: { $gte: periodStart, $lte: periodEnd } } },
        { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
      ]),
      ProcessingQueueJob.aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      FraudAlert.aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      AuditLog.countDocuments({ createdAt: { $gte: periodStart, $lte: periodEnd } }),
    ]);

    const payload = {
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      generatedBy: req.user?.sub,
      ingestionSummary,
      queueSummary,
      alertSummary,
      auditEventsCount: auditSummary,
      evidence: {
        ingestionCollection: 'ingestion_events',
        queueCollection: 'processing_queue_jobs',
        alertsCollection: 'fraud_alerts',
        auditCollection: 'audit_logs',
      },
    };
    const checksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const snapshot = await ComplianceReportSnapshot.create({
      snapshotId: `CRS-${uuidv4().slice(0, 10).toUpperCase()}`,
      periodStart,
      periodEnd,
      generatedBy: req.user?.sub || 'admin',
      payload,
      checksum,
    });
    return res.status(201).json({ success: true, data: snapshot });
  }
);

router.get(
  '/compliance/snapshots',
  [query('limit').optional().isInt({ min: 1, max: 200 }).toInt()],
  validateRequest,
  async (req, res) => {
    const limit = req.query.limit || 50;
    const snapshots = await ComplianceReportSnapshot.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: snapshots });
  }
);

router.post(
  '/compliance/schedules',
  [
    body('name').isString().notEmpty(),
    body('frequency').isIn(['daily', 'weekly', 'monthly']),
    body('hourUtc').optional().isInt({ min: 0, max: 23 }).toInt(),
    body('dayOfWeekUtc').optional().isInt({ min: 0, max: 6 }).toInt(),
    body('dayOfMonthUtc').optional().isInt({ min: 1, max: 31 }).toInt(),
    body('recipients').optional().isArray(),
  ],
  validateRequest,
  async (req, res) => {
    const nextRunAt = computeNextRun(req.body);
    const schedule = await ComplianceReportSchedule.create({
      scheduleId: `CRSCH-${uuidv4().slice(0, 10).toUpperCase()}`,
      name: req.body.name,
      frequency: req.body.frequency,
      hourUtc: req.body.hourUtc ?? 0,
      dayOfWeekUtc: req.body.dayOfWeekUtc,
      dayOfMonthUtc: req.body.dayOfMonthUtc,
      recipients: req.body.recipients || [],
      createdBy: req.user?.sub || 'admin',
      nextRunAt,
    });
    res.status(201).json({ success: true, data: schedule });
  }
);

router.get('/compliance/schedules', async (_req, res) => {
  const schedules = await ComplianceReportSchedule.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: schedules });
});

router.get(
  '/compliance/snapshots/:snapshotId',
  [param('snapshotId').isString().notEmpty()],
  validateRequest,
  async (req, res) => {
    const snapshot = await ComplianceReportSnapshot.findOne({ snapshotId: req.params.snapshotId }).lean();
    if (!snapshot) return res.status(404).json({ success: false, error: 'Snapshot not found' });
    return res.json({ success: true, data: snapshot });
  }
);

module.exports = router;
function computeNextRun({ frequency, hourUtc, dayOfWeekUtc, dayOfMonthUtc }) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hourUtc ?? 0);
  if (frequency === 'daily') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (frequency === 'weekly') {
    const target = Number.isFinite(dayOfWeekUtc) ? dayOfWeekUtc : 1;
    const delta = (target - next.getUTCDay() + 7) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + delta);
    return next;
  }
  const targetDay = Number.isFinite(dayOfMonthUtc) ? dayOfMonthUtc : 1;
  next.setUTCDate(targetDay);
  if (next <= now) {
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(targetDay);
  }
  return next;
}

