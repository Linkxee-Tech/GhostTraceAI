'use strict';

const express = require('express');
const { body } = require('express-validator');
const { exchangeApiKeyForToken } = require('../../services/authService');
const { authLimiter, validateRequest } = require('../middleware/validators');
const logger = require('../../utils/logger').forModule('authRoutes');

const router = express.Router();

/**
 * POST /api/v1/auth/token
 * Exchange an API key for a short-lived JWT.
 * Body: { apiKey: string }
 */
router.post(
  '/token',
  authLimiter,
  [body('apiKey').isString().notEmpty().withMessage('apiKey is required')],
  validateRequest,
  (req, res) => {
    try {
      const token = exchangeApiKeyForToken(req.body.apiKey);
      logger.info({ ip: req.ip }, 'Token issued');
      res.json({ success: true, data: { token } });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
