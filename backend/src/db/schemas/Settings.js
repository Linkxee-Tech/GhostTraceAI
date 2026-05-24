const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  orgName: { type: String, default: 'GhostTrace Global' },
  supportEmail: { type: String, default: 'soc@ghosttrace.ai' },
  autoBlockThreshold: { type: Number, default: 90 },
  autoFlagThreshold: { type: Number, default: 75 },
  mfaRequired: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
