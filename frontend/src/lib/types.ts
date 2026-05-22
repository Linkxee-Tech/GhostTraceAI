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
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: { total: number; page: number; limit: number; pages: number; };
  error?: string;
}
