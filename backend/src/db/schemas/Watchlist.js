const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  entityId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['IP Address', 'Account', 'Device Hash', 'Email'], required: true },
  value: { type: String, required: true },
  reason: { type: String, required: true },
  addedBy: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Watchlist', watchlistSchema);
