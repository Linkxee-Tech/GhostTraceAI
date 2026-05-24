const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  weight: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Rule', ruleSchema);
