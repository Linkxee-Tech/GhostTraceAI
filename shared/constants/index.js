'use strict';

/** Fraud score thresholds */
const SCORE = {
  BLOCK:   80,
  REVIEW:  65,
  FLAG:    50,
  LOW:     30,
};

/** WebSocket event names */
const WS_EVENTS = {
  TRANSACTION_UPDATE:  'transaction:update',
  AGENT_REASONING:     'agent:reasoning',
  AGENT_ERROR:         'agent:error',
};

/** Agent action types */
const ACTIONS = {
  CLEAR:          'clear',
  FLAG:           'flag',
  BLOCK:          'block',
  FREEZE:         'freeze',
  ESCALATE:       'escalate',
  REQUEST_REVIEW: 'request_review',
};

/** Transaction statuses */
const TX_STATUS = {
  PENDING:      'pending',
  CLEARED:      'cleared',
  FLAGGED:      'flagged',
  BLOCKED:      'blocked',
  FROZEN:       'frozen',
  UNDER_REVIEW: 'under_review',
  APPROVED:     'approved',
  REJECTED:     'rejected',
};

/** Alert severities */
const SEVERITY = {
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  CRITICAL: 'critical',
};

/** Audit event types */
const AUDIT_EVENTS = {
  TRANSACTION_RECEIVED:     'transaction_received',
  AGENT_REASONING_START:    'agent_reasoning_start',
  AGENT_REASONING_COMPLETE: 'agent_reasoning_complete',
  FRAUD_SCORE_CALCULATED:   'fraud_score_calculated',
  ACTION_EXECUTED:          'action_executed',
  ALERT_CREATED:            'alert_created',
  NOTIFICATION_SENT:        'notification_sent',
  HUMAN_REVIEW_REQUESTED:   'human_review_requested',
  HUMAN_REVIEW_COMPLETED:   'human_review_completed',
  FALSE_POSITIVE_MARKED:    'false_positive_marked',
  STREAM_ERROR:             'stream_error',
  AGENT_FALLBACK:           'agent_fallback',
};

module.exports = { SCORE, WS_EVENTS, ACTIONS, TX_STATUS, SEVERITY, AUDIT_EVENTS };
