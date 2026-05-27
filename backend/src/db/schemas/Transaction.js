'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

// Sub-schema: Device fingerprint
const DeviceSchema = new Schema({
  fingerprint: { type: String, index: true },
  ipAddress: { type: String },
  ipCountry: { type: String },
  ipCity: { type: String },
  userAgent: { type: String },
  isTor: { type: Boolean, default: false },
  isVpn: { type: Boolean, default: false },
  isKnownDevice: { type: Boolean, default: false },
}, { _id: false });

// Sub-schema: Geolocation
const GeoSchema = new Schema({
  country: { type: String },
  city: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  distanceFromLastKm: { type: Number, default: 0 },
  isAnomaly: { type: Boolean, default: false },
}, { _id: false });

// Sub-schema: Merchant info
const MerchantSchema = new Schema({
  id: { type: String },
  name: { type: String },
  category: { type: String },
  mcc: { type: String },        // Merchant Category Code
  country: { type: String },
  riskTier: { type: String, enum: ['low', 'medium', 'high', 'blocked'], default: 'low' },
}, { _id: false });

// Main Transaction schema
const TransactionSchema = new Schema(
  {
    txnId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    type: {
      type: String,
      enum: ['debit', 'credit', 'transfer', 'withdrawal', 'purchase', 'wire'],
      required: true,
    },
    channel: {
      type: String,
      enum: ['online', 'pos', 'atm', 'mobile', 'api', 'wire'],
      default: 'online',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'bank_transfer', 'wallet', 'crypto', 'ach', 'cash', 'other'],
      default: 'other',
      index: true,
    },
    sourceSystem: {
      type: String,
      default: 'internal_api',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    riskFlags: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'cleared', 'flagged', 'blocked', 'frozen', 'under_review', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    merchant: MerchantSchema,
    device: DeviceSchema,
    geo: GeoSchema,

    // AI Agent fields
    agentProcessed: { type: Boolean, default: false, index: true },
    agentProcessedAt: { type: Date },
    agentLock: { type: Boolean, default: false, index: true },
    fraudScore: { type: Number, min: 0, max: 100, default: null },
    fraudConfidence: { type: Number, min: 0, max: 1, default: null },
    isFraud: { type: Boolean, default: null },
    fraudReasons: [{ type: String }],
    agentAction: {
      type: String,
      enum: ['clear', 'flag', 'block', 'freeze', 'escalate', 'request_review', null],
      default: null,
    },
    agentActionAt: { type: Date },
    reviewRequired: { type: Boolean, default: false },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    reviewOutcome: { type: String, enum: ['confirmed_fraud', 'false_positive', 'inconclusive', null], default: null },

    // Embeddings for Atlas vector search and semantic similarity
    aiVector: [{ type: Number }],

    // Velocity tracking
    velocityCount1min: { type: Number, default: 0 },
    velocityCount5min: { type: Number, default: 0 },
    velocityCount1hr: { type: Number, default: 0 },
    velocityAmtToday: { type: Number, default: 0 },

    // Metadata
    tags: [{ type: String }],
    rawPayload: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

// ── Indexes ─────────────────────────────────────────────────
// accountId + createdAt compound for velocity queries
TransactionSchema.index({ accountId: 1, createdAt: -1 });
// Compound: status + agentProcessed for work queue
TransactionSchema.index({ status: 1, agentProcessed: 1 });
// Compound: fraudScore for threshold queries
TransactionSchema.index({ fraudScore: -1, createdAt: -1 });
// For device fingerprint lookups
TransactionSchema.index({ 'device.fingerprint': 1, createdAt: -1 });
// For geo anomaly analysis
TransactionSchema.index({ 'geo.country': 1, accountId: 1 });
// Text index for search
TransactionSchema.index({ 'merchant.name': 'text', txnId: 'text' });
TransactionSchema.index({ sourceSystem: 1, createdAt: -1 });

// TTL: archive processed, non-flagged transactions after 90 days
TransactionSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days
    partialFilterExpression: {
      status: { $in: ['cleared'] },
      fraudScore: { $lt: 20 },
    },
  }
);

// Mask sensitive fields when converting to JSON
TransactionSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  if (obj.device?.ipAddress) {
    obj.device.ipAddress = obj.device.ipAddress.replace(/\d+$/, 'xxx');
  }
  if (obj.rawPayload) {
    delete obj.rawPayload;
  }
  return obj;
};

module.exports = mongoose.model('Transaction', TransactionSchema);
