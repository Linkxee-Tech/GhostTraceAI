'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const IngestionEventSchema = new Schema(
  {
    ingestId: { type: String, required: true, unique: true, index: true },
    sourceSystem: { type: String, required: true, index: true },
    sourceType: { type: String, enum: ['api', 'webhook', 'simulate', 'batch'], required: true, index: true },
    externalEventId: { type: String, required: true },
    externalTransactionId: { type: String },
    payloadHash: { type: String, required: true },
    processingStatus: { type: String, enum: ['accepted', 'rejected', 'duplicate'], required: true, index: true },
    rejectionReason: { type: String },
    normalizedTxnId: { type: String, index: true },
    channel: { type: String },
    receivedAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date },
    requestMeta: {
      ipAddress: { type: String },
      userAgent: { type: String },
      actorId: { type: String },
    },
    rawPayload: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'ingestion_events',
  }
);

IngestionEventSchema.index({ sourceSystem: 1, externalEventId: 1 }, { unique: true });
IngestionEventSchema.index({ sourceSystem: 1, receivedAt: -1 });

module.exports = mongoose.model('IngestionEvent', IngestionEventSchema);

