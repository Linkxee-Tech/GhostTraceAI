'use strict';

const express = require('express');
const { getDashboardStats, getDemoDashboardStats } = require('../../services/statsService');
const { healthCheck } = require('../../db/connection');
const { isActive, getStatus } = require('../../db/changeStream');
const { getConnectionCount } = require('../../services/websocketService');
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
 * Query params:
 *   - demo=true : Force return demo data (for preview/testing)
 *   - fallback=true : Return demo data if live data is empty (default: true)
 */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const forceDemo = req.query.demo === 'true';
    const allowFallback = req.query.fallback !== 'false';

    if (forceDemo) {
      return res.json({ success: true, data: getDemoDashboardStats(), source: 'demo' });
    }

    const stats = await getDashboardStats();
    
    // Fallback to demo data if live data is minimal (empty database scenario)
    if (allowFallback && !stats.totalToday && !stats.agentDecisions) {
      const demoStats = getDemoDashboardStats();
      return res.json({ success: true, data: demoStats, source: 'demo_fallback' });
    }

    res.json({ success: true, data: stats, source: 'live' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/stats/demo
 * Return demo dashboard stats (requires auth, but always returns demo data).
 * Useful for preview/testing without seeding the database.
 */
router.get('/stats/demo', authenticate, (_req, res) => {
  res.json({
    success: true,
    data: getDemoDashboardStats(),
    source: 'demo',
    note: 'This endpoint always returns demo data for testing/preview purposes.',
  });
});

/**
 * GET /api/v1/health/telemetry
 * Authenticated runtime telemetry for production monitoring dashboards.
 */
router.get('/health/telemetry', authenticate, async (req, res) => {
  try {
    const db = await healthCheck();
    const socketConnections = await getConnectionCount();
    const changeStream = getStatus();
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        uptimeSec: Math.floor(process.uptime()),
        database: db,
        changeStream,
        socketConnections,
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
