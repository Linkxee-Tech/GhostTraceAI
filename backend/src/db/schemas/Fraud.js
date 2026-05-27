'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────
// FraudAlert — one per suspicious transaction
// ─────────────────────────────────────────────────────────────
const FraudAlertSchema = new Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    txnId: { type: String, required: true, index: true },
    accountId: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved', 'false_positive'],
      default: 'open',
      index: true,
    },
    fraudScore: { type: Number, required: true },
    fraudConfidence: { type: Number, required: true },
    triggerReasons: [{ type: String }],
    geminiExplanation: { type: String },  // Human-readable AI explanation
    riskFactors: {
      velocityScore: Number,
      geoAnomalyScore: Number,
      deviceTrustScore: Number,
      merchantRiskScore: Number,
      behavioralDriftScore: Number,
      networkPatternScore: Number,
    },
    agentAction: { type: String },
    agentActionAt: { type: Date },
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: Date },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    notificationsSent: [
      {
        channel: String,
        recipient: String,
        sentAt: Date,
        status: String,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'fraud_alerts',
  }
);

FraudAlertSchema.index({ createdAt: -1 });
FraudAlertSchema.index({ severity: 1, status: 1 });

// TTL: retain alerts for 1 year
FraudAlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

// ─────────────────────────────────────────────────────────────
// AuditLog — immutable record of every agent decision and action
// ─────────────────────────────────────────────────────────────
const AuditLogSchema = new Schema(
  {
    auditId: { type: String, required: true, unique: true },
    eventType: {
      type: String,
      enum: [
        'transaction_received',
        'agent_reasoning_start',
        'agent_reasoning_complete',
        'fraud_score_calculated',
        'action_executed',
        'alert_created',
        'notification_sent',
        'human_review_requested',
        'human_review_completed',
        'false_positive_marked',
        'stream_error',
        'agent_fallback',
      ],
      required: true,
      index: true,
    },
    txnId: { type: String, index: true },
    accountId: { type: String },
    actorType: {
      type: String,
      enum: ['agent', 'analyst', 'system', 'api'],
      default: 'agent',
    },
    actorId: { type: String },
    action: { type: String },
    details: { type: Schema.Types.Mixed },
    latencyMs: { type: Number },
    success: { type: Boolean, default: true },
    errorMessage: { type: String },
    ipAddress: { type: String },  // For human actor events
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

// Audit logs are immutable — disable updates
AuditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable');
});
AuditLogSchema.pre('updateMany', function () {
  throw new Error('Audit logs are immutable');
});

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ txnId: 1, createdAt: -1, eventType: 1 });

// TTL: retain audit logs for 7 years (regulatory compliance)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 220752000 });

// ─────────────────────────────────────────────────────────────
// AgentAction — record of every autonomous action taken
// ─────────────────────────────────────────────────────────────
const AgentActionSchema = new Schema(
  {
    actionId: { type: String, required: true, unique: true },
    txnId: { type: String, required: true, index: true },
    accountId: { type: String, required: true },
    actionType: {
      type: String,
      enum: ['clear', 'flag', 'block', 'freeze', 'escalate', 'notify', 'request_review'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'executed', 'failed', 'reverted'],
      default: 'pending',
    },
    fraudScoreAtAction: { type: Number },
    confidenceAtAction: { type: Number },
    reasoning: { type: String },
    executedAt: { type: Date },
    executionLatencyMs: { type: Number },
    revertedAt: { type: Date },
    revertedBy: { type: String },
    revertReason: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'agent_actions',
  }
);

AgentActionSchema.index({ txnId: 1, createdAt: -1 });
AgentActionSchema.index({ actionType: 1, status: 1 });

// ─────────────────────────────────────────────────────────────
// AnalystReview — human-in-the-loop review records
// ─────────────────────────────────────────────────────────────
const AnalystReviewSchema = new Schema(
  {
    reviewId: { type: String, required: true, unique: true },
    txnId: { type: String, required: true, index: true },
    alertId: { type: String, index: true },
    assignedTo: { type: String },
    assignedAt: { type: Date },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'escalated'],
      default: 'pending',
      index: true,
    },
    slaDeadline: { type: Date },
    slaBreached: { type: Boolean, default: false },
    agentRecommendation: { type: String },
    agentScore: { type: Number },
    analystNotes: { type: String },
    outcome: {
      type: String,
      enum: ['confirmed_fraud', 'false_positive', 'inconclusive', null],
      default: null,
    },
    completedAt: { type: Date },
    completedBy: { type: String },
    timeToReviewMs: { type: Number },
  },
  {
    timestamps: true,
    collection: 'analyst_reviews',
  }
);

AnalystReviewSchema.index({ status: 1, priority: 1, createdAt: -1 });
AnalystReviewSchema.index({ assignedTo: 1, status: 1 });

// ─────────────────────────────────────────────────────────────
// ModelExplanation — stores Gemini reasoning artifacts
// ─────────────────────────────────────────────────────────────
const ModelExplanationSchema = new Schema(
  {
    explanationId: { type: String, required: true, unique: true },
    txnId: { type: String, required: true, index: true },
    model: { type: String, required: true },
    promptVersion: { type: String, default: 'v1' },
    promptTokens: { type: Number },
    outputTokens: { type: Number },
    latencyMs: { type: Number },
    rawPrompt: { type: String },
    rawResponse: { type: String },
    parsedOutput: {
      riskScore: Number,
      fraudCategory: String,
      fraudScore: Number,
      confidence: Number,
      riskFactors: [{ factor: String, score: Number, description: String }],
      explanation: String,
      recommendedAction: String,
      reasoning: [String],
    },
    fallbackUsed: { type: Boolean, default: false },
    fallbackReason: { type: String },
  },
  {
    timestamps: true,
    collection: 'model_explanations',
  }
);

ModelExplanationSchema.index({ txnId: 1, createdAt: -1 });
// TTL: retain explanations for 1 year
ModelExplanationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = {
  FraudAlert: mongoose.model('FraudAlert', FraudAlertSchema),
  AuditLog: mongoose.model('AuditLog', AuditLogSchema),
  AgentAction: mongoose.model('AgentAction', AgentActionSchema),
  AnalystReview: mongoose.model('AnalystReview', AnalystReviewSchema),
  ModelExplanation: mongoose.model('ModelExplanation', ModelExplanationSchema),
};
