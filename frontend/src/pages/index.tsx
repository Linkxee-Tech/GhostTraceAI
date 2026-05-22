'use client';

import React, { useEffect, useRef } from 'react';
import Head from 'next/head';
import type { NextPage } from 'next';
import Header from '@/components/shared/Header';
import { useStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useDemoData } from '@/hooks/useDemoData';
import { fetchStats, fetchAlerts } from '@/lib/api';
import type { WsTransactionUpdate, WsAgentReasoning } from '@/lib/types';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Lazy-load page components — prevents module-scope JSX & hook issues
const OverviewPage     = dynamic(() => import('@/pages/overview'),     { ssr: false });
const TransactionsPage = dynamic(() => import('@/pages/transactions'), { ssr: false });
const AlertsPage       = dynamic(() => import('@/pages/alerts'),       { ssr: false });
const AgentPage        = dynamic(() => import('@/pages/agent'),        { ssr: false });
const AnalyticsPage    = dynamic(() => import('@/pages/analytics'),    { ssr: false });

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  overview:     OverviewPage,
  transactions: TransactionsPage,
  alerts:       AlertsPage,
  agent:        AgentPage,
  analytics:    AnalyticsPage,
};

const Dashboard: NextPage = () => {
  const {
    activeTab,
    wsConnected,
    setWsConnected,
    updateLiveTransaction,
    addReasoningEntry,
    incrementFraudCount,
    incrementDecisionCount,
    setStats,
    setActiveAlerts,
  } = useStore();

  // Stable refs for WS callbacks — avoids stale closures without needing deps arrays
  const storeRef = useRef({
    updateLiveTransaction,
    addReasoningEntry,
    incrementFraudCount,
    incrementDecisionCount,
  });
  useEffect(() => {
    storeRef.current = { updateLiveTransaction, addReasoningEntry, incrementFraudCount, incrementDecisionCount };
  });

  // WebSocket — handlers use ref so they're always fresh
  useWebSocket({
    onConnected:    () => setWsConnected(true),
    onDisconnected: () => setWsConnected(false),

    onTransactionUpdate: (data: WsTransactionUpdate) => {
      storeRef.current.updateLiveTransaction(data);
      storeRef.current.incrementDecisionCount();
      if (data.fraudScore >= 80) {
        storeRef.current.incrementFraudCount();
        toast.error(`🚨 FRAUD BLOCKED: ${data.txnId} — Score ${data.fraudScore}`, { duration: 6000 });
      } else if (data.fraudScore >= 50) {
        toast(`⚠ Flagged: ${data.txnId} — Score ${data.fraudScore}`, {
          duration: 4000,
          style: { borderLeft: '3px solid #ffb43a' },
        });
      }
    },

    onAgentReasoning: (data: WsAgentReasoning) => {
      storeRef.current.addReasoningEntry(data);
    },

    onAgentError: (data: { txnId: string; error: string }) => {
      toast.error(`Agent error on ${data.txnId}: ${data.error}`, { duration: 5000 });
    },
  });

  // Demo data — active whenever WebSocket is not connected
  useDemoData(!wsConnected);

  // Initial API load + 30s stats refresh
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [statsRes, alertsRes] = await Promise.allSettled([
          fetchStats(),
          fetchAlerts({ status: 'open', limit: 50 }),
        ]);
        if (cancelled) return;
        if (statsRes.status  === 'fulfilled') setStats(statsRes.value);
        if (alertsRes.status === 'fulfilled') setActiveAlerts(alertsRes.value.data);
      } catch {
        // Backend offline — demo data already seeded
      }
    };

    load();

    const interval = setInterval(() => {
      if (!cancelled) fetchStats().then(setStats).catch(() => {});
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Head>
        <title>GhostTrace AI — Fraud Intelligence Platform</title>
        <meta name="description" content="Autonomous real-time fraud detection and response agent powered by Gemini AI and MongoDB" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gt-bg flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto" id="main-content">
          {Object.entries(TAB_COMPONENTS).map(([id, TabComponent]) => (
            <div
              key={id}
              id={`panel-${id}`}
              role="tabpanel"
              aria-labelledby={`tab-${id}`}
              hidden={activeTab !== id}
              className="px-6 py-5"
            >
              {activeTab === id && <TabComponent />}
            </div>
          ))}
        </main>

        <footer className="border-t border-[rgba(255,255,255,0.05)] px-6 py-2 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-mono text-gt-dim">
            GhostTrace AI v1.0.0 · Google Cloud Rapid Agent Hackathon 2026
          </span>
          <span className="text-[10px] font-mono text-gt-dim">
            Gemini 3 · MongoDB Atlas · MCP · Cloud Run
          </span>
        </footer>
      </div>
    </>
  );
};

export default Dashboard;
