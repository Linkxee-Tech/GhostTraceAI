'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  listUsers,
  createUser,
  updateUser,
  revokeSession,
  getCurrentUser,
} = require('../../services/authService');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const logger = require('../../utils/logger').forModule('userRoutes');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

router.get(
  '/',
  [
    query('role').optional().isIn(['admin', 'analyst', 'auditor', 'viewer']),
    query('status').optional().isIn(['active', 'disabled']),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const users = await listUsers({ role: req.query.role, status: req.query.status });
      res.json({ success: true, data: users });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').optional().isString(),
    body('role').isIn(['admin', 'analyst', 'auditor', 'viewer']).withMessage('Role is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const user = await createUser(req.body);
      logger.info({ userId: user.userId, createdBy: req.user.sub }, 'User created');
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.get(
  '/:userId',
  [param('userId').isString().notEmpty()],
  validateRequest,
  async (req, res) => {
    try {
      const user = await getCurrentUser(req.params.userId);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.patch(
  '/:userId',
  [
    param('userId').isString().notEmpty(),
    body('role').optional().isIn(['admin', 'analyst', 'auditor', 'viewer']),
    body('status').optional().isIn(['active', 'disabled']),
    body('name').optional().isString(),
    body('email').optional().isEmail(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const user = await updateUser(req.params.userId, req.body);
      logger.info({ userId: user.userId, updatedBy: req.user.sub }, 'User updated');
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.delete(
  '/:userId/sessions/:sessionId',
  [
    param('userId').isString().notEmpty(),
    param('sessionId').isString().notEmpty(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      await revokeSession(req.params.userId, req.params.sessionId);
      logger.info({ userId: req.params.userId, revokedBy: req.user.sub, sessionId: req.params.sessionId }, 'Session revoked');
      res.json({ success: true, data: { message: 'Session revoked' } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
