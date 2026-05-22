'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { Transaction, FraudAlert, AgentActionRecord, DashboardStats } from '@/lib/types';

// ── Seed Data ─────────────────────────────────────────────────
const DEMO_TRANSACTIONS: Transaction[] = [
  {
    _id: '1', txnId: 'TXN-A9F3-2847', accountId: 'ACC-98230', amount: 47892, currency: 'USD',
    type: 'wire', channel: 'api', status: 'blocked', agentProcessed: true, agentProcessedAt: new Date(Date.now()-30000).toISOString(),
    fraudScore: 94, fraudConfidence: 0.943, isFraud: true,
    fraudReasons: ['velocity_spike', 'geo_anomaly', 'unknown_device'],
    agentAction: 'block', reviewRequired: false, velocityCount1min: 4,
    merchant: { name: 'Crypto Exchange', category: 'cryptocurrency', country: 'UA', riskTier: 'high' },
    geo: { country: 'Ukraine', city: 'Kyiv', distanceFromLastKm: 6742, isAnomaly: true },
    device: { isKnownDevice: false, isTor: false, isVpn: true, ipCountry: 'RU' },
    createdAt: new Date(Date.now()-30000).toISOString(), updatedAt: new Date(Date.now()-28000).toISOString(),
  },
  {
    _id: '2', txnId: 'TXN-B2E1-5501', accountId: 'ACC-55010', amount: 1240, currency: 'USD',
    type: 'purchase', channel: 'online', status: 'cleared', agentProcessed: true, agentProcessedAt: new Date(Date.now()-60000).toISOString(),
    fraudScore: 8, fraudConfidence: 0.97, isFraud: false,
    fraudReasons: [], agentAction: 'clear', reviewRequired: false, velocityCount1min: 0,
    merchant: { name: 'Amazon Prime', category: 'retail', country: 'US', riskTier: 'low' },
    geo: { country: 'Nigeria', city: 'Lagos', distanceFromLastKm: 12, isAnomaly: false },
    device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
    createdAt: new Date(Date.now()-60000).toISOString(), updatedAt: new Date(Date.now()-59000).toISOString(),
  },
  {
    _id: '3', txnId: 'TXN-C7D8-1193', accountId: 'ACC-11930', amount: 8500, currency: 'USD',
    type: 'transfer', channel: 'api', status: 'flagged', agentProcessed: true, agentProcessedAt: new Date(Date.now()-90000).toISOString(),
    fraudScore: 67, fraudConfidence: 0.81, isFraud: null,
    fraudReasons: ['unusual_amount', 'high_risk_merchant'], agentAction: 'flag', reviewRequired: true, velocityCount1min: 1,
    merchant: { name: 'Wire Transfer Co.', category: 'financial_services', country: 'GB', riskTier: 'medium' },
    geo: { country: 'Nigeria', city: 'Abuja', distanceFromLastKm: 0, isAnomaly: false },
    device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
    createdAt: new Date(Date.now()-90000).toISOString(), updatedAt: new Date(Date.now()-88000).toISOString(),
  },
  {
    _id: '4', txnId: 'TXN-E9A6-7723', accountId: 'ACC-77230', amount: 22000, currency: 'USD',
    type: 'purchase', channel: 'online', status: 'frozen', agentProcessed: true, agentProcessedAt: new Date(Date.now()-120000).toISOString(),
    fraudScore: 89, fraudConfidence: 0.91, isFraud: true,
    fraudReasons: ['tor_detected', 'geo_anomaly', 'velocity_spike'], agentAction: 'freeze', reviewRequired: true, velocityCount1min: 5,
    merchant: { name: 'Forex Broker', category: 'financial_services', country: 'RU', riskTier: 'high' },
    geo: { country: 'Russia', city: 'Moscow', distanceFromLastKm: 9200, isAnomaly: true },
    device: { isKnownDevice: false, isTor: true, isVpn: false, ipCountry: 'RU' },
    createdAt: new Date(Date.now()-120000).toISOString(), updatedAt: new Date(Date.now()-118000).toISOString(),
  },
  {
    _id: '5', txnId: 'TXN-F1B3-4410', accountId: 'ACC-44100', amount: 670, currency: 'USD',
    type: 'purchase', channel: 'online', status: 'under_review', agentProcessed: true, agentProcessedAt: new Date(Date.now()-150000).toISOString(),
    fraudScore: 52, fraudConfidence: 0.74, isFraud: null,
    fraudReasons: ['new_merchant', 'amount_drift'], agentAction: 'request_review', reviewRequired: true, velocityCount1min: 0,
    merchant: { name: 'PayPal Transfer', category: 'financial_services', country: 'GB', riskTier: 'medium' },
    geo: { country: 'United Kingdom', city: 'London', distanceFromLastKm: 5200, isAnomaly: false },
    device: { isKnownDevice: false, isTor: false, isVpn: false, ipCountry: 'GB' },
    createdAt: new Date(Date.now()-150000).toISOString(), updatedAt: new Date(Date.now()-148000).toISOString(),
  },
  {
    _id: '6', txnId: 'TXN-G3C7-8892', accountId: 'ACC-88920', amount: 3100, currency: 'USD',
    type: 'purchase', channel: 'online', status: 'flagged', agentProcessed: true, agentProcessedAt: new Date(Date.now()-180000).toISOString(),
    fraudScore: 62, fraudConfidence: 0.78, isFraud: null,
    fraudReasons: ['gambling_merchant', 'unusual_pattern'], agentAction: 'flag', reviewRequired: false, velocityCount1min: 2,
    merchant: { name: 'Betting Site', category: 'gambling', country: 'GI', riskTier: 'high' },
    geo: { country: 'Gibraltar', city: 'Gibraltar', distanceFromLastKm: 4200, isAnomaly: false },
    device: { isKnownDevice: false, isTor: false, isVpn: true, ipCountry: 'GI' },
    createdAt: new Date(Date.now()-180000).toISOString(), updatedAt: new Date(Date.now()-178000).toISOString(),
  },
  {
    _id: '7', txnId: 'TXN-H5D1-2201', accountId: 'ACC-22010', amount: 88, currency: 'USD',
    type: 'purchase', channel: 'online', status: 'cleared', agentProcessed: true, agentProcessedAt: new Date(Date.now()-210000).toISOString(),
    fraudScore: 4, fraudConfidence: 0.99, isFraud: false,
    fraudReasons: [], agentAction: 'clear', reviewRequired: false, velocityCount1min: 0,
    merchant: { name: 'Spotify', category: 'entertainment', country: 'SE', riskTier: 'low' },
    geo: { country: 'Nigeria', city: 'Lagos', distanceFromLastKm: 0, isAnomaly: false },
    device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
    createdAt: new Date(Date.now()-210000).toISOString(), updatedAt: new Date(Date.now()-208000).toISOString(),
  },
  {
    _id: '8', txnId: 'TXN-D4F2-3381', accountId: 'ACC-33810', amount: 245, currency: 'USD',
    type: 'purchase', channel: 'pos', status: 'cleared', agentProcessed: true, agentProcessedAt: new Date(Date.now()-240000).toISOString(),
    fraudScore: 5, fraudConfidence: 0.98, isFraud: false,
    fraudReasons: [], agentAction: 'clear', reviewRequired: false, velocityCount1min: 0,
    merchant: { name: 'Netflix', category: 'entertainment', country: 'US', riskTier: 'low' },
    geo: { country: 'Nigeria', city: 'Lagos', distanceFromLastKm: 0, isAnomaly: false },
    device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
    createdAt: new Date(Date.now()-240000).toISOString(), updatedAt: new Date(Date.now()-238000).toISOString(),
  },
];

const DEMO_ALERTS: FraudAlert[] = [
  {
    _id: 'a1', alertId: 'ALT-F83A2B1C', txnId: 'TXN-A9F3-2847', accountId: 'ACC-98230',
    severity: 'critical', status: 'open', fraudScore: 94, fraudConfidence: 0.943,
    triggerReasons: ['velocity_spike', 'geo_anomaly_6742km', 'vpn_detected', 'unknown_device'],
    geminiExplanation: 'Transaction exhibits multiple high-confidence fraud indicators: 4 transactions within 1 minute from this account, geographic jump of 6,742km from last known location (Lagos to Kyiv), VPN usage detected, and unknown device fingerprint. Recommend immediate block and account review.',
    riskFactors: { velocityScore: 92, geoAnomalyScore: 95, deviceTrustScore: 75, merchantRiskScore: 80, behavioralDriftScore: 65 },
    agentAction: 'block', agentActionAt: new Date(Date.now()-28000).toISOString(),
    createdAt: new Date(Date.now()-28000).toISOString(),
  },
  {
    _id: 'a2', alertId: 'ALT-C9D7E2F4', txnId: 'TXN-E9A6-7723', accountId: 'ACC-77230',
    severity: 'high', status: 'open', fraudScore: 89, fraudConfidence: 0.91,
    triggerReasons: ['tor_exit_node', 'geo_anomaly_9200km', 'velocity_spike'],
    geminiExplanation: 'TOR exit node detected on transaction originating 9,200km from account home location. Five transactions attempted in under 4 minutes. Account frozen pending analyst review.',
    riskFactors: { velocityScore: 88, geoAnomalyScore: 98, deviceTrustScore: 95, merchantRiskScore: 70, behavioralDriftScore: 72 },
    agentAction: 'freeze', agentActionAt: new Date(Date.now()-118000).toISOString(),
    createdAt: new Date(Date.now()-118000).toISOString(),
  },
  {
    _id: 'a3', alertId: 'ALT-B2E9A1D8', txnId: 'TXN-C7D8-1193', accountId: 'ACC-11930',
    severity: 'medium', status: 'acknowledged', fraudScore: 67, fraudConfidence: 0.81,
    triggerReasons: ['unusual_amount', 'high_risk_merchant'],
    geminiExplanation: 'Wire transfer amount exceeds account average by 3.4 standard deviations. Merchant category flagged as elevated risk. Flagged for analyst review.',
    riskFactors: { velocityScore: 15, geoAnomalyScore: 20, deviceTrustScore: 5, merchantRiskScore: 65, behavioralDriftScore: 70 },
    agentAction: 'flag', agentActionAt: new Date(Date.now()-88000).toISOString(),
    createdAt: new Date(Date.now()-88000).toISOString(),
  },
];

const DEMO_AGENT_ACTIONS: AgentActionRecord[] = [
  { _id: 'ac1', actionId: 'ACT-F83A2B1C', txnId: 'TXN-A9F3-2847', accountId: 'ACC-98230', actionType: 'block', status: 'executed', fraudScoreAtAction: 94, confidenceAtAction: 0.943, reasoning: 'Multiple high-confidence fraud signals detected. Auto-blocked.', executedAt: new Date(Date.now()-28000).toISOString(), executionLatencyMs: 412 },
  { _id: 'ac2', actionId: 'ACT-C9D7E2F4', txnId: 'TXN-E9A6-7723', accountId: 'ACC-77230', actionType: 'freeze', status: 'executed', fraudScoreAtAction: 89, confidenceAtAction: 0.91, reasoning: 'TOR node + geo anomaly. Account frozen pending review.', executedAt: new Date(Date.now()-118000).toISOString(), executionLatencyMs: 387 },
  { _id: 'ac3', actionId: 'ACT-B2E9A1D8', txnId: 'TXN-C7D8-1193', accountId: 'ACC-11930', actionType: 'flag', status: 'executed', fraudScoreAtAction: 67, confidenceAtAction: 0.81, reasoning: 'Elevated risk merchant + amount drift. Flagged for review.', executedAt: new Date(Date.now()-88000).toISOString(), executionLatencyMs: 298 },
  { _id: 'ac4', actionId: 'ACT-A1B3C5D7', txnId: 'TXN-H5D1-2201', accountId: 'ACC-22010', actionType: 'clear', status: 'executed', fraudScoreAtAction: 4, confidenceAtAction: 0.99, reasoning: 'Known device, known merchant, low amount. Fast-path clear.', executedAt: new Date(Date.now()-208000).toISOString(), executionLatencyMs: 45 },
  { _id: 'ac5', actionId: 'ACT-E9F2A4B6', txnId: 'TXN-D4F2-3381', accountId: 'ACC-33810', actionType: 'clear', status: 'executed', fraudScoreAtAction: 5, confidenceAtAction: 0.98, reasoning: 'Normal recurring transaction. Cleared.', executedAt: new Date(Date.now()-238000).toISOString(), executionLatencyMs: 38 },
];

const DEMO_STATS: DashboardStats = {
  totalToday: 12847, fraudDetected: 23, pendingReview: 8,
  agentDecisions: 147, avgLatencyMs: 284, accuracy: 98.2,
  threatLevel: 73, blockedAmount: 93892,
};

// Simulated new transactions that arrive every few seconds
const NEW_TX_POOL: Partial<Transaction>[] = [
  { amount: 125, currency: 'USD', type: 'purchase', channel: 'online', status: 'cleared', fraudScore: 7, agentAction: 'clear', merchant: { name: 'Google Play', category: 'entertainment', country: 'US', riskTier: 'low' } },
  { amount: 5500, currency: 'USD', type: 'transfer', channel: 'api', status: 'flagged', fraudScore: 58, agentAction: 'flag', merchant: { name: 'Wire Transfer', category: 'financial_services', country: 'GB', riskTier: 'medium' } },
  { amount: 340, currency: 'USD', type: 'purchase', channel: 'pos', status: 'cleared', fraudScore: 3, agentAction: 'clear', merchant: { name: 'Supermarket', category: 'grocery', country: 'NG', riskTier: 'low' } },
  { amount: 18000, currency: 'USD', type: 'wire', channel: 'api', status: 'blocked', fraudScore: 87, agentAction: 'block', merchant: { name: 'Unknown Entity', category: 'other', country: 'XX', riskTier: 'high' } },
  { amount: 99, currency: 'USD', type: 'purchase', channel: 'online', status: 'cleared', fraudScore: 5, agentAction: 'clear', merchant: { name: 'Adobe CC', category: 'software', country: 'US', riskTier: 'low' } },
  { amount: 7200, currency: 'USD', type: 'transfer', channel: 'api', status: 'under_review', fraudScore: 71, agentAction: 'request_review', merchant: { name: 'Remittance Co.', category: 'financial_services', country: 'AE', riskTier: 'medium' } },
];

let txCounter = 100;

function makeNewTx(): Transaction {
  const base = NEW_TX_POOL[txCounter % NEW_TX_POOL.length];
  txCounter++;
  const now = new Date().toISOString();
  return {
    _id: String(txCounter),
    txnId: `TXN-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${txCounter}`,
    accountId: `ACC-${String(Math.floor(Math.random() * 90000) + 10000)}`,
    currency: 'USD',
    type: 'purchase',
    channel: 'online',
    status: 'pending',
    agentProcessed: false,
    agentProcessedAt: null,
    isFraud: null,
    fraudReasons: [],
    agentAction: null,
    reviewRequired: false,
    velocityCount1min: 0,
    createdAt: now,
    updatedAt: now,
    ...base,
    fraudScore: base.fraudScore ?? null,
    fraudConfidence: base.fraudScore ? (90 + Math.random() * 9) / 100 : null,
  } as Transaction;
}

// ── Hook ──────────────────────────────────────────────────────
export function useDemoData(enabled: boolean) {
  const {
    addLiveTransaction,
    setActiveAlerts,
    addAgentAction,
    addReasoningEntry,
    setStats,
  } = useStore();

  const seededRef = useRef(false);

  // Seed initial data once
  useEffect(() => {
    if (!enabled || seededRef.current) return;
    seededRef.current = true;

    // Load static seed data
    DEMO_TRANSACTIONS.forEach((t) => addLiveTransaction(t));
    setActiveAlerts(DEMO_ALERTS);
    DEMO_AGENT_ACTIONS.forEach((a) => addAgentAction(a));
    setStats(DEMO_STATS);

    // Seed reasoning log
    addReasoningEntry({ txnId: 'TXN-A9F3-2847', stage: 'acting',    message: 'Executed BLOCK — confidence 94.3%',              fraudScore: 94 });
    addReasoningEntry({ txnId: 'TXN-E9A6-7723', stage: 'reasoning', message: 'Gemini detected TOR + 9,200km geo jump',           fraudScore: 89 });
    addReasoningEntry({ txnId: 'TXN-C7D8-1193', stage: 'planning',  message: 'Computing velocity + behavioral drift scores...'              });
    addReasoningEntry({ txnId: 'TXN-H5D1-2201', stage: 'acting',    message: 'Fast-path clear — pre-score 4/100',               fraudScore: 4  });
  }, [enabled]);

  // Simulate live stream when WS is not connected
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const tx = makeNewTx();
      addLiveTransaction(tx);

      // Simulate agent processing after 1.2s
      setTimeout(() => {
        const processed: Transaction = {
          ...tx,
          status: tx.fraudScore && tx.fraudScore >= 80 ? 'blocked'
                : tx.fraudScore && tx.fraudScore >= 50 ? 'flagged'
                : 'cleared',
          agentProcessed: true,
          agentProcessedAt: new Date().toISOString(),
        };
        addLiveTransaction(processed);

        if (tx.fraudScore && tx.fraudScore >= 50) {
          addReasoningEntry({
            txnId: tx.txnId,
            stage: 'acting',
            message: `Executed ${processed.status} — score ${tx.fraudScore}/100`,
            fraudScore: tx.fraudScore,
          });
        }
      }, 1200);
    }, 3500);

    return () => clearInterval(interval);
  }, [enabled]);
}
