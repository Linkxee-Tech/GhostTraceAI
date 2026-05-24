'use strict';

const express = require('express');
const { body } = require('express-validator');
const {
  exchangeApiKeyForToken,
  loginWithEmail,
  createUser,
  getCurrentUser,
  createPasswordResetToken,
  resetPassword,
} = require('../../services/authService');
const User = require('../../db/schemas/User');
const { authenticate } = require('../middleware/auth');
const { authLimiter, validateRequest } = require('../middleware/validators');
const logger = require('../../utils/logger').forModule('authRoutes');

const router = express.Router();

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

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const meta = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        deviceFingerprint: req.headers['x-device-fingerprint'] || 'unknown',
      };
      const { user, token } = await loginWithEmail(req.body.email, req.body.password, meta);
      logger.info({ userId: user.userId, ip: req.ip }, 'User logged in');
      res.json({ success: true, data: { user, token } });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').optional().isString(),
    body('role').optional().isIn(['admin', 'analyst', 'auditor', 'viewer']),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const existingUserCount = await User.countDocuments({});
      if (existingUserCount > 0) {
        return res.status(403).json({ success: false, error: 'Registration is disabled after first account creation' });
      }
      const user = await createUser(req.body);
      logger.info({ userId: user.userId, email: user.email }, 'Initial user registered');
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getCurrentUser(req.user.sub);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(
  '/password-reset/request',
  authLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  validateRequest,
  async (req, res) => {
    try {
      const result = await createPasswordResetToken(req.body.email);
      if (!result) return res.status(200).json({ success: true, data: { message: 'If an account exists, a reset email was sent.' } });
      res.json({ success: true, data: { message: 'Password reset instructions sent' } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/password-reset/complete',
  authLimiter,
  [
    body('token').isString().notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const user = await resetPassword(req.body.token, req.body.password);
      res.json({ success: true, data: { message: 'Password updated successfully', user } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/mfa/setup',
  authenticate,
  (req, res) => {
    try {
      // Mock MFA setup for MVP
      res.json({
        success: true,
        data: {
          qrCode: 'mock-qr-code-data',
          secret: 'mock-secret-key'
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/mfa/verify',
  authLimiter,
  [body('code').isString().notEmpty().withMessage('MFA code is required')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock MFA verification logic for MVP.
      // In a real implementation, you would verify the code against the user's secret
      // and issue a new, fully authenticated token.
      if (req.body.code === '123456') { // Simple mock bypass for testing if needed
        return res.json({ success: true, data: { token: 'mock-fully-authenticated-jwt-token' } });
      }
      
      // We will accept any 6 digit code for now to allow the UI to function
      res.json({ success: true, data: { token: 'mock-fully-authenticated-jwt-token' } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
