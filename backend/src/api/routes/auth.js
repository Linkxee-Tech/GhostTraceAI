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
  generateToken,
} = require('../../services/authService');
const User = require('../../db/schemas/User');
const config = require('../../config');
const { authenticate } = require('../middleware/auth');
const { authLimiter, validateRequest } = require('../middleware/validators');
const logger = require('../../utils/logger').forModule('authRoutes');

function buildFallbackUser(req) {
  return {
    userId: req.user.sub || 'dev-user',
    email: req.body?.email || req.user.email || 'dev@ghosttrace.ai',
    name: req.user.name || 'Dev Bypass User',
    role: req.user.role || 'analyst',
    status: 'active',
    lastLoginAt: new Date(),
    lastLoginIp: req.ip,
    sessions: [],
  };
}

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
      logger.info({ BYPASS_AUTH: process.env.BYPASS_AUTH, NODE_ENV: process.env.NODE_ENV }, 'Login attempt');
      // Dev bypass mode when BYPASS_AUTH=true (skips database)
      if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
        const inputEmail = String(req.body.email || '').toLowerCase();
        const role = inputEmail.includes('admin') ? 'admin' : 'analyst';
        const name = role === 'admin' ? 'Dev Admin User' : 'Dev User';
        const bypassId = inputEmail.includes('admin')
          ? 'user-dev-admin'
          : inputEmail.includes('demo')
            ? 'user-dev-demo'
            : 'user-dev-user';

        logger.info({ email: req.body.email, role, mode: 'BYPASS_AUTH' }, 'BYPASS_AUTH login');
        const token = generateToken({
          sub: bypassId,
          role,
          email: inputEmail,
          name,
          sessionId: null,
        });
        return res.json({
          success: true,
          data: {
            user: {
              userId: bypassId,
              email: req.body.email,
              name,
              role,
              status: 'active',
              lastLoginAt: new Date(),
              lastLoginIp: req.ip,
              sessions: [],
            },
            token,
          },
        });
      }

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
    if (!user) {
      if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
        return res.json({ success: true, data: buildFallbackUser(req) });
      }
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return res.json({ success: true, data: buildFallbackUser(req) });
    }
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
  authenticate,
  [body('code').isString().notEmpty().withMessage('MFA code is required')],
  validateRequest,
  async (req, res) => {
    try {
      const code = req.body.code;
      const expectedCode = config.mfa.autoVerifyCode;

      // Mock MFA verification for local/demo environments. Replace this block with a real OTP provider later.
      if (!config.mfa.autoVerifyEnabled || code !== expectedCode) {
        return res.status(401).json({ success: false, error: 'Invalid authentication code' });
      }

      const payload = {
        sub: req.user.sub,
        role: req.user.role,
        sessionId: req.user.sessionId,
      };
      if (req.user.email) payload.email = req.user.email;
      if (req.user.name) payload.name = req.user.name;

      const token = generateToken(payload);

      return res.json({ success: true, data: { token } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
