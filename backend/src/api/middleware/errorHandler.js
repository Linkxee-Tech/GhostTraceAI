'use strict';

const logger = require('../../utils/logger').forModule('errorHandler');
const config = require('../../config');

/**
 * Central Express error handler.
 * Always returns consistent { success, error } JSON.
 * Never leaks stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const isKnown = status < 500;

  // Log server errors with full context; client errors at debug level
  if (isKnown) {
    logger.debug({ err: err.message, path: req.path, method: req.method }, 'Client error');
  } else {
    logger.error({ err, path: req.path, method: req.method, user: req.user?.sub }, 'Server error');
  }

  // Build response — never expose internals in production
  const body = {
    success: false,
    error:   isKnown || config.app.isDev ? err.message : 'Internal server error',
  };

  if (config.app.isDev && !isKnown) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

/**
 * 404 handler — catches any route not matched by the router.
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
  });
}

module.exports = { errorHandler, notFound };
