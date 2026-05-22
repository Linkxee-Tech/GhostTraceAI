'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { StatCard } from '@/components/shared/ui';
import { TransactionFeed } from '@/components/transactions/TransactionFeed';
import { AlertsPanel } from '@/components/alerts/AlertsPanel';
import { ThreatGauge, RiskFactorBreakdown, GeoAnomalyPanel } from '@/components/dashboard/ThreatGauge';
import { AgentReasoningFeed, AgentActionsLog } from '@/components/agent/AgentLog';
import { VolumeChart, ActionDistributionChart, FraudHeatmap } from '@/components/dashboard/Charts';

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

  // Derive risk factors from most recent high-risk open alert
  const latestAlert = activeAlerts.find((a) => a.status === 'open' && a.fraudScore >= 50);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Transactions / min"
          value={(stats?.totalToday ?? liveTransactions.length).toLocaleString()}
          delta="+12% last hour"
          accent="green"
        />
        <StatCard
          label="Fraud Detected"
          value={stats?.fraudDetected ?? liveTransactions.filter((t) => t.isFraud).length}
          delta={`↑ ${stats?.fraudDetected ?? 0} this session`}
          accent="red"
        />
        <StatCard
          label="Pending Review"
          value={stats?.pendingReview ?? liveTransactions.filter((t) => t.status === 'under_review').length}
          delta={`${activeAlerts.filter((a) => a.status === 'open').length} flagged by agent`}
          accent="amber"
        />
        <StatCard
          label="Agent Decisions"
          value={stats?.agentDecisions ?? agentActions.length}
          delta={`Accuracy ${stats?.accuracy != null ? stats.accuracy : 98.2}%`}
          accent="blue"
        />
      </div>

      {/* ── Row 1: Transaction Feed + Threat Gauge ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 220px' }}>
        <TransactionFeed />
        <div className="flex flex-col gap-4">
          <ThreatGauge />
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
        <ActionDistributionChart />
      </div>

      {/* ── Row 4: Heatmap + Agent Actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FraudHeatmap />
        <AgentActionsLog />
      </div>
    </div>
  );
}
