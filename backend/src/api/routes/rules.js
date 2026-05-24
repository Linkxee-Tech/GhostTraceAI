'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const Rule = require('../../db/schemas/Rule');
const Settings = require('../../db/schemas/Settings');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/rules
router.get('/', async (req, res) => {
  try {
    const rules = await Rule.find();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/rules/:id
router.patch('/:id', async (req, res) => {
  try {
    const updatedRule = await Rule.findOneAndUpdate(
      { ruleId: req.params.id },
      { $set: { status: req.body.status } },
      { new: true }
    );
    if (!updatedRule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: updatedRule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/rules/thresholds (This updates settings but is routed here per frontend)
router.patch('/thresholds', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    settings.autoBlockThreshold = req.body.autoBlockThreshold ?? settings.autoBlockThreshold;
    settings.autoFlagThreshold = req.body.autoFlagThreshold ?? settings.autoFlagThreshold;
    
    await settings.save();
    
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
