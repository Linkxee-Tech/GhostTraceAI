'use strict';

const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const config = require('../../config');

/**
 * Standard API rate limiter — 100 req/min per IP.
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many requests — please slow down' },
  skip: () => config.app.isTest,
});

/**
 * Strict limiter for auth endpoints — 10 req/min.
 */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max:      10,
  message: { success: false, error: 'Too many auth attempts' },
  skip: () => config.app.isTest,
});

/**
 * Middleware that checks express-validator results and returns 400 on failure.
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error:   'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { apiLimiter, authLimiter, validateRequest };
