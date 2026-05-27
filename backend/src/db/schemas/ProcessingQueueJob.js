'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ProcessingQueueJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    jobType: { type: String, enum: ['agent_process', 'event_replay'], required: true, index: true },
    source: { type: String, default: 'change_stream', index: true },
    txnId: { type: String, index: true },
    sourceSystem: { type: String, index: true },
    ingestId: { type: String, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'dead_letter'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date },
    lastError: { type: String },
  },
  {
    timestamps: true,
    collection: 'processing_queue_jobs',
  }
);

ProcessingQueueJobSchema.index({ status: 1, nextAttemptAt: 1 });
ProcessingQueueJobSchema.index({ sourceSystem: 1, createdAt: -1 });

module.exports = mongoose.model('ProcessingQueueJob', ProcessingQueueJobSchema);

