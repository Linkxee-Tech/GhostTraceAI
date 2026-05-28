// ── Transaction ─────────────────────────────────────────────
export type TransactionStatus =
  | 'pending' | 'cleared' | 'flagged' | 'blocked'
  | 'frozen' | 'under_review' | 'approved' | 'rejected';

export type AgentAction =
  | 'clear' | 'flag' | 'block' | 'freeze'
  | 'escalate' | 'request_review' | null;

export interface Transaction {
  _id: string;
  txnId: string;
  accountId: string;
  amount: number;
  currency: string;
  type: string;
  channel: string;
  paymentMethod?: string;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
  riskFlags?: string[];
  status: TransactionStatus;
  merchant?: { name: string; category: string; country: string; riskTier: string; };
  device?: { isKnownDevice: boolean; isTor: boolean; isVpn: boolean; ipCountry: string; };
  geo?: { country: string; city: string; distanceFromLastKm: number; isAnomaly: boolean; };
  fraudScore: number | null;
  fraudConfidence: number | null;
  isFraud: boolean | null;
  fraudReasons: string[];
  agentAction: AgentAction;
  agentProcessed: boolean;
  agentProcessedAt: string | null;
  reviewRequired: boolean;
  velocityCount1min: number;
  createdAt: string;
  updatedAt: string;
}

// ── Fraud Alert ──────────────────────────────────────────────
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive';

export interface RiskFactors {
  velocityScore: number;
  geoAnomalyScore: number;
  deviceTrustScore: number;
  merchantRiskScore: number;
  behavioralDriftScore: number;
  networkPatternScore?: number;
}

export interface FraudAlert {
  _id: string;
  alertId: string;
  txnId: string;
  accountId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  fraudScore: number;
  fraudConfidence: number;
  triggerReasons: string[];
  geminiExplanation: string;
  riskFactors: RiskFactors;
  agentAction: string;
  agentActionAt: string;
  createdAt: string;
}

// ── Agent Action ─────────────────────────────────────────────
export interface AgentActionRecord {
  _id: string;
  actionId: string;
  txnId: string;
  accountId: string;
  actionType: string;
  status: string;
  fraudScoreAtAction: number;
  confidenceAtAction: number;
  reasoning: string;
  executedAt: string;
  executionLatencyMs: number;
}

// ── Analyst Review ───────────────────────────────────────────
export interface AnalystReview {
  _id: string;
  reviewId: string;
  txnId: string;
  alertId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'escalated';
  agentRecommendation: string;
  agentScore: number;
  analystNotes?: string;
  outcome?: string;
  slaDeadline: string;
  slaBreached: boolean;
  createdAt: string;
}

// ── WebSocket Events ─────────────────────────────────────────
export interface WsTransactionUpdate {
  txnId: string;
  accountId?: string;
  status: TransactionStatus;
  fraudScore: number;
  action: AgentAction;
  explanation?: string;
  alertId?: string;
  reviewId?: string;
  riskFactors?: Partial<RiskFactors>;
  timestamp: string;
}

export interface WsAgentReasoning {
  txnId: string;
  stage: 'planning' | 'reasoning' | 'acting';
  message: string;
  preScore?: number;
  fraudScore?: number;
}

// ── Dashboard Stats ──────────────────────────────────────────
export interface DashboardStats {
  totalToday: number;
  fraudDetected: number;
  pendingReview: number;
  agentDecisions: number;
  avgLatencyMs: number;
  accuracy: number;
  threatLevel: number;
  blockedAmount: number;
}

// ── API Response wrapper ──────────────────────────────────────
export interface UserSession {
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  deviceFingerprint: string;
  createdAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface UserAccount {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst' | 'auditor' | 'viewer';
  accountType?: 'admin' | 'demo' | 'user' | 'analyst' | 'auditor' | 'viewer';
  status: 'active' | 'disabled';
  lastLoginAt?: string;
  lastLoginIp?: string;
  sessions?: UserSession[];
  sessionCount?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: { total: number; page: number; limit: number; pages: number; };
  error?: string;
}

// ── Case Management ───────────────────────────────────────────
export type CaseStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface CaseNote {
  noteId: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

export interface FraudCase {
  _id: string;
  caseId: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedTo: string;
  relatedTxnIds: string[];
  relatedAlertIds: string[];
  notes: CaseNote[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Watchlist ─────────────────────────────────────────────────
export type WatchlistEntityType = 'IP Address' | 'Account' | 'Device Hash' | 'Email';

export interface WatchlistEntity {
  _id: string;
  entityId: string;
  type: WatchlistEntityType;
  value: string;
  reason: string;
  addedBy: string;
  createdAt: string;
}

// ── Audit Log ─────────────────────────────────────────────────
export type AuditLogStatus = 'Success' | 'Failed' | 'Warning';

export interface AuditLog {
  _id: string;
  logId: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  status: AuditLogStatus;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

// ── Rule Config ───────────────────────────────────────────────
export interface RuleConfig {
  _id: string;
  ruleId: string;
  name: string;
  description: string;
  category: string;
  status: 'Active' | 'Inactive';
  weight: 'Low' | 'Medium' | 'High' | 'Critical';
}

// ── General Settings ──────────────────────────────────────────
export interface GeneralSettings {
  orgName: string;
  supportEmail: string;
  autoBlockThreshold: number;
  autoFlagThreshold: number;
  mfaRequired: boolean;
  webhookUrl?: string;
  apiKeys?: Array<{
    apiKeyId: string;
    name: string;
    keyPrefix: string;
    keyLast4: string;
    status: 'active' | 'revoked';
    createdBy: string;
    createdAt: string;
    lastUsedAt?: string;
  }>;
  webhookTestLogs?: Array<{
    url: string;
    statusCode?: number;
    success: boolean;
    error?: string;
    testedAt: string;
    testedBy: string;
  }>;
}

export interface IngestionEventRecord {
  ingestId: string;
  sourceSystem: string;
  sourceType: 'api' | 'webhook' | 'simulate' | 'batch';
  externalEventId: string;
  processingStatus: 'accepted' | 'rejected' | 'duplicate' | 'failed';
  rejectionReason?: string;
  normalizedTxnId?: string;
  receivedAt: string;
}

export interface IngestionSummary {
  windowHours: number;
  statusStats: Array<{ _id: string; count: number }>;
  sourceStats: Array<{ _id: string; count: number }>;
  recentFailures: IngestionEventRecord[];
}

export interface ReplayJob {
  jobId: string;
  jobType: 'agent_process' | 'event_replay';
  sourceSystem?: string;
  ingestId?: string;
  txnId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: string;
}

export interface ComplianceSnapshot {
  snapshotId: string;
  periodStart: string;
  periodEnd: string;
  checksum: string;
  createdAt: string;
}

export interface ComplianceSchedule {
  scheduleId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
  nextRunAt?: string;
  createdAt: string;
}
