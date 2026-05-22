import axios, { AxiosError } from 'axios';
import type {
  ApiResponse, Transaction, FraudAlert,
  AgentActionRecord, AnalystReview, DashboardStats
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach stored JWT on every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gt_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handler
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error: string }>) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('gt_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Stats ────────────────────────────────────────────────────
export const fetchStats = async (): Promise<DashboardStats> => {
  const { data } = await apiClient.get<ApiResponse<DashboardStats>>('/stats');
  return data.data;
};

// ── Transactions ─────────────────────────────────────────────
export const fetchTransactions = async (params?: {
  page?: number; limit?: number; status?: string; minScore?: number;
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
