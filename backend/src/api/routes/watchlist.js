'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const Watchlist = require('../../db/schemas/Watchlist');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/watchlist
router.get('/', async (req, res) => {
  try {
    const watchlist = await Watchlist.find().sort({ createdAt: -1 });
    res.json({ success: true, data: watchlist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/watchlist
router.post('/', async (req, res) => {
  try {
    const entityId = `WL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const newEntity = new Watchlist({
      ...req.body,
      entityId,
      addedBy: req.user.email || 'system'
    });
    await newEntity.save();
    res.status(201).json({ success: true, data: newEntity });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/watchlist/:id
router.delete('/:id', async (req, res) => {
  try {
    const deletedEntity = await Watchlist.findOneAndDelete({ entityId: req.params.id });
    if (!deletedEntity) return res.status(404).json({ success: false, error: 'Entity not found' });
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
