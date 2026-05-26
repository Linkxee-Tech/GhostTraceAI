'use strict';

const express = require('express');
const crypto = require('crypto');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validators');
const Settings = require('../../db/schemas/Settings');

const router = express.Router();

router.use(authenticate);

function toPublicSettings(settings) {
  const settingsObj = settings.toObject();
  settingsObj.apiKeys = (settingsObj.apiKeys || []).map((key) => ({
    apiKeyId: String(key._id),
    name: key.name,
    keyPrefix: key.keyPrefix,
    keyLast4: key.keyLast4,
    status: key.status,
    createdBy: key.createdBy,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
  }));
  settingsObj.webhookTestLogs = (settingsObj.webhookTestLogs || []).slice(0, 20);
  return settingsObj;
}

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json({ success: true, data: toPublicSettings(settings) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch(
  '/',
  requireRole('admin'),
  [
    body('orgName').optional().isString(),
    body('supportEmail').optional().isEmail(),
    body('mfaRequired').optional().isBoolean(),
    body('webhookUrl').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      let settings = await Settings.findOne();
      if (!settings) settings = new Settings();

      if (req.body.orgName !== undefined) settings.orgName = req.body.orgName;
      if (req.body.supportEmail !== undefined) settings.supportEmail = req.body.supportEmail;
      if (req.body.mfaRequired !== undefined) settings.mfaRequired = req.body.mfaRequired;
      if (req.body.webhookUrl !== undefined) settings.webhookUrl = req.body.webhookUrl;
      await settings.save();

      res.json({ success: true, data: toPublicSettings(settings) });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/api-keys',
  requireRole('admin'),
  [body('name').isString().trim().isLength({ min: 2, max: 64 })],
  validateRequest,
  async (req, res) => {
    try {
      let settings = await Settings.findOne();
      if (!settings) settings = new Settings();

      const key = `gt_prod_${crypto.randomBytes(20).toString('hex')}`;
      const keyPrefix = key.slice(0, 12);
      const keyLast4 = key.slice(-4);
      const keyHash = crypto.createHash('sha256').update(key).digest('hex');
      const createdBy = req.user.email || req.user.sub || 'admin';

      settings.apiKeys.push({
        name: req.body.name.trim(),
        keyPrefix,
        keyLast4,
        keyHash,
        status: 'active',
        createdBy,
        createdAt: new Date(),
      });
      await settings.save();

      res.json({ success: true, data: { key } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.delete(
  '/api-keys/:apiKeyId',
  requireRole('admin'),
  [param('apiKeyId').isString().notEmpty()],
  validateRequest,
  async (req, res) => {
    try {
      const settings = await Settings.findOne();
      if (!settings) return res.status(404).json({ success: false, error: 'Settings not found' });

      const key = settings.apiKeys.id(req.params.apiKeyId);
      if (!key) return res.status(404).json({ success: false, error: 'API key not found' });

      key.status = 'revoked';
      await settings.save();

      return res.json({ success: true, data: { apiKeyId: req.params.apiKeyId, status: 'revoked' } });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/webhooks/test',
  requireRole('admin'),
  [body('url').isURL().withMessage('Valid webhook URL is required')],
  validateRequest,
  async (req, res) => {
    try {
      const payload = {
        type: 'ghosttrace.webhook.test',
        createdAt: new Date().toISOString(),
        source: 'GhostTrace AI',
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      let response;
      try {
        response = await fetch(req.body.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      let settings = await Settings.findOne();
      if (!settings) settings = new Settings();
      settings.webhookTestLogs = [
        {
          url: req.body.url,
          statusCode: response.status,
          success: response.ok,
          testedAt: new Date(),
          testedBy: req.user.email || req.user.sub || 'admin',
        },
        ...(settings.webhookTestLogs || []),
      ].slice(0, 50);
      await settings.save();

      return res.json({
        success: true,
        data: {
          success: response.ok,
          statusCode: response.status,
        },
      });
    } catch (err) {
      let settings = await Settings.findOne();
      if (!settings) settings = new Settings();
      settings.webhookTestLogs = [
        {
          url: req.body.url,
          statusCode: 0,
          success: false,
          error: err.message || 'Webhook test failed',
          testedAt: new Date(),
          testedBy: req.user.email || req.user.sub || 'admin',
        },
        ...(settings.webhookTestLogs || []),
      ].slice(0, 50);
      await settings.save();

      return res.status(400).json({
        success: false,
        error: err.message || 'Webhook test failed',
      });
    }
  }
);

router.get('/webhooks/tests', requireRole('admin'), async (req, res) => {
  try {
    const settings = await Settings.findOne();
    return res.json({ success: true, data: settings?.webhookTestLogs || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
