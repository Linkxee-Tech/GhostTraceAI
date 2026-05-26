const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  orgName: { type: String, default: 'GhostTrace Global' },
  supportEmail: { type: String, default: 'soc@ghosttrace.ai' },
  autoBlockThreshold: { type: Number, default: 90 },
  autoFlagThreshold: { type: Number, default: 75 },
  mfaRequired: { type: Boolean, default: true },
  webhookUrl: { type: String, default: '' },
  apiKeys: [
    {
      name: { type: String, required: true },
      keyPrefix: { type: String, required: true },
      keyLast4: { type: String, required: true },
      keyHash: { type: String, required: true, select: false },
      status: { type: String, enum: ['active', 'revoked'], default: 'active' },
      createdBy: { type: String, default: 'system' },
      lastUsedAt: { type: Date },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  webhookTestLogs: [
    {
      url: { type: String, required: true },
      statusCode: { type: Number },
      success: { type: Boolean, default: false },
      error: { type: String },
      testedAt: { type: Date, default: Date.now },
      testedBy: { type: String, default: 'system' },
    },
  ],
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
