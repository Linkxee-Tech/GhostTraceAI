'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { StatCard } from '@/components/shared/ui';
import { TransactionFeed } from '@/components/transactions/TransactionFeed';
import { AlertsPanel } from '@/components/alerts/AlertsPanel';
import { ThreatGauge, RiskFactorBreakdown, GeoAnomalyPanel } from '@/components/dashboard/ThreatGauge';
import AgentStatusCard from '@/components/agent/AgentStatusCard';
import AgentInsightsCard from '@/components/agent/AgentInsightsCard';
import RecentCasesPanel from '@/components/cases/RecentCasesPanel';
import { AgentReasoningFeed, AgentActionsLog } from '@/components/agent/AgentLog';
import { VolumeChart, RiskDistributionChart, FraudHeatmap } from '@/components/dashboard/Charts';

// Demo geo data — replaced by live API data in production
const DEMO_GEO = [
  { country: 'Nigeria (Origin)', count: 1842, isAnomaly: false },
  { country: 'Ukraine',          count: 47,   isAnomaly: true  },
  { country: 'Russia',           count: 31,   isAnomaly: true  },
  { country: 'United Kingdom',   count: 289,  isAnomaly: false },
  { country: 'United States',    count: 412,  isAnomaly: false },
];

export default function OverviewPage() {
  const { stats, activeAlerts, liveTransactions, agentActions } = useStore();

  const hasAnyData = Boolean(
    stats || activeAlerts.length > 0 || liveTransactions.length > 0 || agentActions.length > 0
  );

  // Derive risk factors from most recent high-risk open alert
  const latestAlert = activeAlerts.find((a) => a.status === 'open' && a.fraudScore >= 50);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Transactions Today"
          value={(stats?.totalToday ?? liveTransactions.length).toLocaleString()}
          delta="vs yesterday"
          accent="green"
        />
        <StatCard
          label="Flagged Transactions"
          value={liveTransactions.filter((t) => t.status === 'flagged' || t.status === 'under_review').length}
          delta="vs yesterday"
          accent="amber"
        />
        <StatCard
          label="High Risk Transactions"
          value={liveTransactions.filter((t) => t.fraudScore !== null && t.fraudScore >= 80).length}
          delta="vs yesterday"
          accent="red"
        />
        <StatCard
          label="Blocked Transactions"
          value={liveTransactions.filter((t) => t.status === 'blocked').length}
          delta="vs yesterday"
          accent="blue"
        />
      </div>

      {!hasAnyData && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-gt-surface p-5 text-sm text-gt-muted">
          No live dashboard data is available yet. If you are using a demo account, this page will populate once the demo state is initialized or you connect to a live backend.
        </div>
      )}
      {/* ── Row 1: Transaction Feed + Threat Gauge ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 220px' }}>
        <TransactionFeed />
        <div className="flex flex-col gap-4">
          <ThreatGauge />
          <AgentStatusCard />
          <RiskFactorBreakdown factors={latestAlert?.riskFactors} />
        </div>
      </div>

      {/* ── Row 2: Agent Reasoning + Alerts + Geo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <AgentReasoningFeed />
        <div className="flex flex-col gap-4">
          <AlertsPanel />
          <GeoAnomalyPanel entries={DEMO_GEO} />
        </div>
      </div>

      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <VolumeChart />
        <RiskDistributionChart />
      </div>

      {/* ── Row 4: Heatmap + Agent Actions ── */}
      {/* ── Recent Cases ── */}
      <div>
        <RecentCasesPanel />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FraudHeatmap />
        <AgentActionsLog />
      </div>
    </div>
  );
}
