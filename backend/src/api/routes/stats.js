'use strict';

const express = require('express');
const { getDashboardStats } = require('../../services/statsService');
const { healthCheck } = require('../../db/connection');
const { isActive } = require('../../db/changeStream');
const { authenticate } = require('../middleware/auth');
const logger = require('../../utils/logger').forModule('statsRoutes');

const router = express.Router();

/**
 * GET /api/v1/health
 * Public health check — used by Cloud Run liveness probe.
 */
router.get('/health', async (req, res) => {
  try {
    const db = await healthCheck();
    const status = db.status === 'healthy' ? 'ok' : 'degraded';

    res.status(status === 'ok' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database:    { status: db.status, latencyMs: db.latencyMs },
        changeStream:{ status: isActive() ? 'active' : 'inactive' },
        agent:       { status: 'running' },
      },
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

/**
 * GET /api/v1/stats
 * Dashboard statistics — requires auth.
 */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
