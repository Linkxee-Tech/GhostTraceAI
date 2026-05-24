'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const Case = require('../../db/schemas/Case');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/cases
router.get('/', async (req, res) => {
  try {
    const cases = await Case.find().sort({ createdAt: -1 });
    res.json({ success: true, data: cases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/cases/:id
router.get('/:id', async (req, res) => {
  try {
    const fraudCase = await Case.findOne({ caseId: req.params.id });
    if (!fraudCase) return res.status(404).json({ success: false, error: 'Case not found' });
    res.json({ success: true, data: fraudCase });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/cases
router.post('/', async (req, res) => {
  try {
    const caseId = `CAS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const newCase = new Case({
      ...req.body,
      caseId,
      createdBy: req.user.email || 'system'
    });
    await newCase.save();
    res.status(201).json({ success: true, data: newCase });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/cases/:id
router.patch('/:id', async (req, res) => {
  try {
    const updatedCase = await Case.findOneAndUpdate(
      { caseId: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!updatedCase) return res.status(404).json({ success: false, error: 'Case not found' });
    res.json({ success: true, data: updatedCase });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/v1/cases/:id/notes
router.post('/:id/notes', async (req, res) => {
  try {
    const noteId = `NOT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const newNote = {
      noteId,
      authorEmail: req.user.email || 'unknown',
      content: req.body.content
    };
    
    const updatedCase = await Case.findOneAndUpdate(
      { caseId: req.params.id },
      { $push: { notes: newNote } },
      { new: true }
    );
    
    if (!updatedCase) return res.status(404).json({ success: false, error: 'Case not found' });
    res.json({ success: true, data: updatedCase });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
