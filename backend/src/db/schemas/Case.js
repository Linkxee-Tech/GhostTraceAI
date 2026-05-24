const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  noteId: { type: String, required: true },
  authorEmail: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const caseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  assignedTo: { type: String, default: 'Unassigned' },
  relatedTxnIds: [{ type: String }],
  relatedAlertIds: [{ type: String }],
  notes: [noteSchema],
  createdBy: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Case', caseSchema);
