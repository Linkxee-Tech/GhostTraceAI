import { create } from 'zustand';
import type {
  Transaction, FraudAlert, AgentActionRecord,
  DashboardStats, WsTransactionUpdate, WsAgentReasoning
} from '../lib/types';

interface ReasoningEntry {
  txnId: string;
  stage: string;
  message: string;
  timestamp: Date;
  fraudScore?: number;
}

interface GhostTraceStore {
  // Connection
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;

  // Live transaction feed (most recent first, max 50)
  liveTransactions: Transaction[];
  addLiveTransaction: (t: Transaction) => void;
  updateLiveTransaction: (update: WsTransactionUpdate) => void;

  // Alerts
  activeAlerts: FraudAlert[];
  setActiveAlerts: (alerts: FraudAlert[]) => void;
  addAlert: (alert: FraudAlert) => void;
  dismissAlert: (alertId: string) => void;

  // Agent reasoning feed
  reasoningLog: ReasoningEntry[];
  addReasoningEntry: (entry: WsAgentReasoning) => void;

  // Agent actions log
  agentActions: AgentActionRecord[];
  addAgentAction: (action: AgentActionRecord) => void;

  // Stats
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;
  incrementFraudCount: () => void;
  incrementDecisionCount: () => void;

  // UI
  selectedTxnId: string | null;
  setSelectedTxnId: (id: string | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useStore = create<GhostTraceStore>((set) => ({
  // Connection
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  // Live transactions
  liveTransactions: [],
  addLiveTransaction: (t) =>
    set((s) => ({
      // Upsert by txnId to avoid duplicate rows when a pending txn is later updated.
      liveTransactions: [t, ...s.liveTransactions.filter((x) => x.txnId !== t.txnId)].slice(0, 50),
    })),
  updateLiveTransaction: (update) =>
    set((s) => {
      const timestamp = update.timestamp || new Date().toISOString();
      const idx = s.liveTransactions.findIndex((t) => t.txnId === update.txnId);

      if (idx === -1) {
        // WebSocket-first upsert: when no prior txn exists in the store, create a minimal row.
        const synthesized: Transaction = {
          _id: `ws-${update.txnId}`,
          txnId: update.txnId,
          accountId: update.accountId || 'UNKNOWN',
          amount: 0,
          currency: 'USD',
          type: 'transfer',
          channel: 'api',
          status: update.status,
          fraudScore: update.fraudScore,
          fraudConfidence: null,
          isFraud: update.fraudScore >= 80 ? true : update.fraudScore < 50 ? false : null,
          fraudReasons: [],
          agentAction: update.action,
          agentProcessed: true,
          agentProcessedAt: timestamp,
          reviewRequired: update.status === 'under_review',
          velocityCount1min: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        return { liveTransactions: [synthesized, ...s.liveTransactions].slice(0, 50) };
      }

      const existing = s.liveTransactions[idx];
      const updated: Transaction = {
        ...existing,
        accountId: update.accountId || existing.accountId,
        status: update.status,
        fraudScore: update.fraudScore,
        isFraud: update.fraudScore >= 80 ? true : existing.isFraud,
        agentAction: update.action,
        agentProcessed: true,
        agentProcessedAt: timestamp,
        reviewRequired: update.status === 'under_review' ? true : existing.reviewRequired,
        updatedAt: timestamp,
      };

      return {
        liveTransactions: [
          updated,
          ...s.liveTransactions.filter((t) => t.txnId !== update.txnId),
        ].slice(0, 50),
      };
    }),

  // Alerts
  activeAlerts: [],
  setActiveAlerts: (alerts) => set({ activeAlerts: alerts }),
  addAlert: (alert) =>
    set((s) => ({ activeAlerts: [alert, ...s.activeAlerts].slice(0, 100) })),
  dismissAlert: (alertId) =>
    set((s) => ({ activeAlerts: s.activeAlerts.filter((a) => a.alertId !== alertId) })),

  // Reasoning
  reasoningLog: [],
  addReasoningEntry: (entry) =>
    set((s) => ({
      reasoningLog: [
        { ...entry, timestamp: new Date() },
        ...s.reasoningLog,
      ].slice(0, 100),
    })),

  // Agent actions
  agentActions: [],
  addAgentAction: (action) =>
    set((s) => ({ agentActions: [action, ...s.agentActions].slice(0, 100) })),

  // Stats
  stats: null,
  setStats: (stats) => set({ stats }),
  incrementFraudCount: () =>
    set((s) => s.stats ? { stats: { ...s.stats, fraudDetected: s.stats.fraudDetected + 1 } } : {}),
  incrementDecisionCount: () =>
    set((s) => s.stats ? { stats: { ...s.stats, agentDecisions: s.stats.agentDecisions + 1 } } : {}),

  // UI
  selectedTxnId: null,
  setSelectedTxnId: (id) => set({ selectedTxnId: id }),
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
