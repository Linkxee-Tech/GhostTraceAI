import axios, { AxiosError } from 'axios';
import { getApiHost, getToken, clearSession } from './authSession';
import type {
  ApiResponse, Transaction, FraudAlert,
  AgentActionRecord, AnalystReview, DashboardStats,
  UserAccount,
  IngestionEventRecord,
  IngestionSummary,
  ReplayJob,
  ComplianceSnapshot,
  ComplianceSchedule,
} from './types';


const API_URL = getApiHost();

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach stored JWT on every request
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error: string }>) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Stats ────────────────────────────────────────────────────
export const fetchStats = async (options?: { demo?: boolean; fallback?: boolean }): Promise<DashboardStats> => {
  const params = new URLSearchParams();
  if (options?.demo) params.append('demo', 'true');
  if (options?.fallback === false) params.append('fallback', 'false');
  
  const { data } = await apiClient.get<ApiResponse<DashboardStats>>(
    `/stats${params.toString() ? `?${params.toString()}` : ''}`
  );
  return data.data;
};

// ── Transactions ─────────────────────────────────────────────
export const fetchTransactions = async (params?: {
  page?: number; limit?: number; status?: string; minScore?: number; query?: string;
}): Promise<ApiResponse<Transaction[]>> => {
  const { data } = await apiClient.get<ApiResponse<Transaction[]>>('/transactions', { params });
  return data;
};

export const fetchTransaction = async (txnId: string): Promise<Transaction> => {
  const { data } = await apiClient.get<ApiResponse<Transaction>>(`/transactions/${txnId}`);
  return data.data;
};

// ── Alerts ───────────────────────────────────────────────────
export const fetchAlerts = async (params?: {
  page?: number; limit?: number; severity?: string; status?: string;
}): Promise<ApiResponse<FraudAlert[]>> => {
  const { data } = await apiClient.get<ApiResponse<FraudAlert[]>>('/alerts', { params });
  return data;
};

export const acknowledgeAlert = async (alertId: string): Promise<void> => {
  await apiClient.patch(`/alerts/${alertId}/acknowledge`);
};

export const resolveAlert = async (alertId: string, outcome: string): Promise<void> => {
  await apiClient.patch(`/alerts/${alertId}/resolve`, { outcome });
};

// ── Agent Actions ─────────────────────────────────────────────
export const fetchAgentActions = async (params?: {
  page?: number; limit?: number; actionType?: string;
}): Promise<ApiResponse<AgentActionRecord[]>> => {
  const { data } = await apiClient.get<ApiResponse<AgentActionRecord[]>>('/agent/actions', { params });
  return data;
};

// ── Reviews ──────────────────────────────────────────────────
export const fetchReviews = async (params?: {
  status?: string; priority?: string;
}): Promise<ApiResponse<AnalystReview[]>> => {
  const { data } = await apiClient.get<ApiResponse<AnalystReview[]>>('/agent/reviews', { params });
  return data;
};

export const submitReview = async (reviewId: string, payload: {
  outcome: string; analystNotes: string;
}): Promise<void> => {
  await apiClient.patch(`/agent/reviews/${reviewId}`, payload);
};

export interface SubmitTransactionResult {
  txnId: string;
  status: string;
}

// ── Manual transaction submission (demo/testing) ─────────────
export const submitTransaction = async (payload: Partial<Transaction>): Promise<SubmitTransactionResult> => {
  const { data } = await apiClient.post<ApiResponse<SubmitTransactionResult>>('/transactions', payload);
  return data.data;
};

export interface IngestResult {
  status: 'accepted' | 'duplicate';
  normalizedTxnId: string;
  ingestId: string;
}

export const ingestTransaction = async (payload: Partial<Transaction> & {
  transactionId?: string;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
  riskFlags?: string[];
}): Promise<IngestResult> => {
  const { data } = await apiClient.post<ApiResponse<IngestResult>>('/transactions/ingest', payload);
  return data.data;
};

export const simulateTransaction = async (payload: Partial<Transaction> & {
  transactionId?: string;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
  riskFlags?: string[];
}): Promise<IngestResult> => {
  const { data } = await apiClient.post<ApiResponse<IngestResult>>('/transactions/simulate', payload);
  return data.data;
};

export const ingestTransactionsBatch = async (events: Array<Record<string, unknown>>): Promise<{
  total: number;
  results: Array<{ ok: boolean; status?: string; normalizedTxnId?: string; ingestId?: string; error?: string; externalEventId?: string }>;
}> => {
  const { data } = await apiClient.post<ApiResponse<{
    total: number;
    results: Array<{ ok: boolean; status?: string; normalizedTxnId?: string; ingestId?: string; error?: string; externalEventId?: string }>;
  }>>('/transactions/ingest/batch', { events });
  return data.data;
};

export const fetchIngestionEvents = async (limit = 50): Promise<IngestionEventRecord[]> => {
  const { data } = await apiClient.get<ApiResponse<IngestionEventRecord[]>>('/ingestion/events', { params: { limit } });
  return data.data;
};

// ── Reports (admin) ─────────────────────────────────────────
// (see below) helper to fetch compliance snapshots; ensure only one exported symbol exists

export const fetchIngestionSummary = async (hours = 24): Promise<IngestionSummary> => {
  const { data } = await apiClient.get<ApiResponse<IngestionSummary>>('/ingestion/summary', { params: { hours } });
  return data.data;
};

export const queueReplayWindow = async (payload: {
  sourceSystem?: string;
  from: string;
  to: string;
  limit?: number;
}): Promise<{ queuedJobs: number; candidateEvents: number }> => {
  const { data } = await apiClient.post<ApiResponse<{ queuedJobs: number; candidateEvents: number }>>('/ingestion/replay', payload);
  return data.data;
};

export const fetchReplayJobs = async (limit = 50): Promise<ReplayJob[]> => {
  const { data } = await apiClient.get<ApiResponse<ReplayJob[]>>('/ingestion/replay/jobs', { params: { limit } });
  return data.data;
};

export const runReplayJob = async (jobId: string): Promise<void> => {
  await apiClient.post(`/ingestion/replay/jobs/${jobId}/run`);
};

export const createComplianceSnapshot = async (periodStart: string, periodEnd: string): Promise<ComplianceSnapshot> => {
  const { data } = await apiClient.post<ApiResponse<ComplianceSnapshot>>('/reports/compliance/snapshots', { periodStart, periodEnd });
  return data.data;
};

export const fetchComplianceSnapshots = async (limit = 50): Promise<ComplianceSnapshot[]> => {
  const { data } = await apiClient.get<ApiResponse<ComplianceSnapshot[]>>('/reports/compliance/snapshots', { params: { limit } });
  return data.data;
};

export const createComplianceSchedule = async (payload: {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  hourUtc?: number;
  dayOfWeekUtc?: number;
  dayOfMonthUtc?: number;
  recipients?: string[];
}): Promise<ComplianceSchedule> => {
  const { data } = await apiClient.post<ApiResponse<ComplianceSchedule>>('/reports/compliance/schedules', payload);
  return data.data;
};

export const fetchComplianceSchedules = async (): Promise<ComplianceSchedule[]> => {
  const { data } = await apiClient.get<ApiResponse<ComplianceSchedule[]>>('/reports/compliance/schedules');
  return data.data;
};

export interface LoginResult {
  user: UserAccount;
  token: string;
}

export const login = async (email: string, password: string): Promise<LoginResult> => {
  const { data } = await apiClient.post<ApiResponse<LoginResult>>('/auth/login', { email, password });
  return data.data;
};

export const fetchCurrentUser = async (): Promise<UserAccount> => {
  const { data } = await apiClient.get<ApiResponse<UserAccount>>('/auth/me');
  return data.data;
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  await apiClient.post('/auth/password-reset/request', { email });
};

export const completePasswordReset = async (token: string, password: string): Promise<void> => {
  await apiClient.post('/auth/password-reset/complete', { token, password });
};

export const fetchUsers = async (): Promise<ApiResponse<UserAccount[]>> => {
  const { data } = await apiClient.get<ApiResponse<UserAccount[]>>('/users');
  return data;
};

export const createUserAccount = async (payload: { email: string; password: string; name?: string; role: string; }): Promise<UserAccount> => {
  const { data } = await apiClient.post<ApiResponse<UserAccount>>('/users', payload);
  return data.data;
};

export const updateUserAccount = async (userId: string, payload: Partial<UserAccount>): Promise<UserAccount> => {
  const { data } = await apiClient.patch<ApiResponse<UserAccount>>(`/users/${userId}`, payload);
  return data.data;
};

export const revokeUserSession = async (userId: string, sessionId: string): Promise<void> => {
  await apiClient.delete(`/users/${userId}/sessions/${sessionId}`);
};

// ── MFA ──────────────────────────────────────────────────────
export const verifyMFA = async (code: string): Promise<{ token: string }> => {
  const { data } = await apiClient.post<ApiResponse<{ token: string }>>('/auth/mfa/verify', { code });
  return data.data;
};

export const setupMFA = async (): Promise<{ qrCode: string; secret: string }> => {
  const { data } = await apiClient.post<ApiResponse<{ qrCode: string; secret: string }>>('/auth/mfa/setup');
  return data.data;
};

// ── Cases ────────────────────────────────────────────────────
import type { FraudCase, WatchlistEntity, AuditLog, RuleConfig, GeneralSettings } from './types';

export const fetchCases = async (params?: {
  page?: number; limit?: number; status?: string; priority?: string;
}): Promise<ApiResponse<FraudCase[]>> => {
  const { data } = await apiClient.get<ApiResponse<FraudCase[]>>('/cases', { params });
  return data;
};

export const fetchCase = async (caseId: string): Promise<FraudCase> => {
  const { data } = await apiClient.get<ApiResponse<FraudCase>>(`/cases/${caseId}`);
  return data.data;
};

export const createCase = async (payload: {
  title: string; priority: string; relatedTxnIds?: string[]; relatedAlertIds?: string[];
}): Promise<FraudCase> => {
  const { data } = await apiClient.post<ApiResponse<FraudCase>>('/cases', payload);
  return data.data;
};

export const updateCase = async (caseId: string, payload: {
  status?: string; priority?: string; assignedTo?: string;
}): Promise<FraudCase> => {
  const { data } = await apiClient.patch<ApiResponse<FraudCase>>(`/cases/${caseId}`, payload);
  return data.data;
};

export const addCaseNote = async (caseId: string, content: string): Promise<void> => {
  await apiClient.post(`/cases/${caseId}/notes`, { content });
};

// ── Watchlist ─────────────────────────────────────────────────
export const fetchWatchlist = async (params?: {
  type?: string; search?: string;
}): Promise<ApiResponse<WatchlistEntity[]>> => {
  const { data } = await apiClient.get<ApiResponse<WatchlistEntity[]>>('/watchlist', { params });
  return data;
};

export const addWatchlistEntity = async (payload: {
  type: string; value: string; reason: string;
}): Promise<WatchlistEntity> => {
  const { data } = await apiClient.post<ApiResponse<WatchlistEntity>>('/watchlist', payload);
  return data.data;
};

export const deleteWatchlistEntity = async (entityId: string): Promise<void> => {
  await apiClient.delete(`/watchlist/${entityId}`);
};

// ── Audit Logs ───────────────────────────────────────────────
export const fetchAuditLogs = async (params?: {
  page?: number; limit?: number; action?: string; status?: string;
}): Promise<ApiResponse<AuditLog[]>> => {
  const { data } = await apiClient.get<ApiResponse<AuditLog[]>>('/audit-logs', { params });
  return data;
};

// ── Rules / Models ───────────────────────────────────────────
export const fetchRules = async (): Promise<RuleConfig[]> => {
  const { data } = await apiClient.get<ApiResponse<RuleConfig[]>>('/rules');
  return data.data;
};

export const updateRuleStatus = async (ruleId: string, status: 'Active' | 'Inactive'): Promise<void> => {
  await apiClient.patch(`/rules/${ruleId}`, { status });
};

export const updateThresholds = async (payload: {
  autoBlockThreshold: number; autoFlagThreshold: number;
}): Promise<void> => {
  await apiClient.patch('/rules/thresholds', payload);
};

// ── General Settings ─────────────────────────────────────────
export const fetchSettings = async (): Promise<GeneralSettings> => {
  const { data } = await apiClient.get<ApiResponse<GeneralSettings>>('/settings');
  return data.data;
};

export const saveSettings = async (payload: Partial<GeneralSettings>): Promise<void> => {
  await apiClient.patch('/settings', payload);
};

export const generateApiKey = async (name: string): Promise<{ key: string }> => {
  const { data } = await apiClient.post<ApiResponse<{ key: string }>>('/settings/api-keys', { name });
  return data.data;
};

export const revokeApiKey = async (apiKeyId: string): Promise<void> => {
  await apiClient.delete(`/settings/api-keys/${apiKeyId}`);
};

export const testWebhook = async (url: string): Promise<{ success: boolean; statusCode: number }> => {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean; statusCode: number }>>('/settings/webhooks/test', { url });
  return data.data;
};

export const fetchWebhookTestLogs = async (): Promise<GeneralSettings['webhookTestLogs']> => {
  const { data } = await apiClient.get<ApiResponse<NonNullable<GeneralSettings['webhookTestLogs']>>>('/settings/webhooks/tests');
  return data.data;
};
