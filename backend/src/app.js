'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const compression = require('compression');

const config     = require('./config');
const logger     = require('./utils/logger').forModule('app');
const { apiLimiter } = require('./api/middleware/validators');
const { errorHandler, notFound } = require('./api/middleware/errorHandler');
const { transport } = require('./mcp/mcpServer');

// Route modules
const authRoutes        = require('./api/routes/auth');
const userRoutes        = require('./api/routes/users');
const transactionRoutes = require('./api/routes/transactions');
const alertRoutes       = require('./api/routes/alerts');
const agentRoutes       = require('./api/routes/agent');
const statsRoutes       = require('./api/routes/stats');
const auditRoutes       = require('./api/routes/audit');

function createApp() {
  const app = express();

  // ── Security headers ────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  }));

  // ── CORS ────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Allow server-to-server
      if (config.app.corsOrigins.includes(origin) || config.app.isDev) {
        return cb(null, true);
      }
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }));

  // ── Compression ──────────────────────────────────────────────
  app.use(compression());

  // ── Body parsing ────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // ── HTTP request logging ─────────────────────────────────────
  if (!config.app.isTest) {
    app.use(morgan(config.app.isDev ? 'dev' : 'combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    }));
  }

  // ── Rate limiting ─────────────────────────────────────────────
  app.use('/api/', apiLimiter);

  // ── Routes ───────────────────────────────────────────────────
  app.use('/api/v1/auth',         authRoutes);
  app.use('/api/v1/users',        userRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/alerts',       alertRoutes);
  app.use('/api/v1/agent',        agentRoutes);
  app.use('/api/v1/audit-logs',   auditRoutes); // Frontend expects /audit-logs
  app.use('/api/v1/cases',        require('./api/routes/cases'));
  app.use('/api/v1/watchlist',    require('./api/routes/watchlist'));
  app.use('/api/v1/rules',        require('./api/routes/rules'));
  app.use('/api/v1/settings',     require('./api/routes/settings'));
  app.use('/api/v1',              statsRoutes);   // /health and /stats

  // Root redirect
  app.get('/', (req, res) => {
    res.json({
      name:    'GhostTrace AI API',
      version: '1.0.0',
      status:  'running',
      docs:    '/api/v1/health',
    });
  });

  app.all('/mcp', async (req, res, next) => {
    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      next(err);
    }
  });

  // ── Error handlers (must be last) ────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
