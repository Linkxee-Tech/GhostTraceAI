'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const Settings = require('../../db/schemas/Settings');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/settings
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/settings
router.patch('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    Object.assign(settings, req.body);
    await settings.save();
    
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/v1/settings/api-keys
router.post('/api-keys', async (req, res) => {
  try {
    // In a real app, generate securely and store hashed. 
    // This is a stub for the frontend.
    const key = `gt_prod_${require('crypto').randomBytes(16).toString('hex')}`;
    res.json({ success: true, data: { key } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
