'use client';

import React from 'react';
import { VolumeChart, ActionDistributionChart, FraudHeatmap } from '@/components/dashboard/Charts';
import { Panel } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { formatAmount } from '@/lib/utils';
import { TrendingUp, DollarSign, Shield, Clock } from 'lucide-react';

export default function AnalyticsPage() {
  const { stats, liveTransactions } = useStore();

  const blockedAmount = liveTransactions
    .filter((t) => t.status === 'blocked' || t.status === 'frozen')
    .reduce((s, t) => s + t.amount, 0);

  const avgScore = liveTransactions.length
    ? Math.round(
        liveTransactions.filter((t) => t.fraudScore !== null)
          .reduce((s, t) => s + (t.fraudScore ?? 0), 0) /
        Math.max(liveTransactions.filter((t) => t.fraudScore !== null).length, 1)
      )
    : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Blocked Amount',
            value: formatAmount(blockedAmount),
            icon: <DollarSign size={14} />,
            color: 'text-gt-danger',
          },
          {
            label: 'Detection Rate',
            value: liveTransactions.length
              ? `${Math.round((liveTransactions.filter(t => t.isFraud).length / liveTransactions.length) * 100)}%`
              : '0%',
            icon: <Shield size={14} />,
            color: 'text-gt-accent',
          },
          {
            label: 'Avg Fraud Score',
            value: avgScore,
            icon: <TrendingUp size={14} />,
            color: 'text-gt-warn',
          },
          {
            label: 'Avg Latency',
            value: stats?.avgLatencyMs ? `${stats.avgLatencyMs}ms` : '—',
            icon: <Clock size={14} />,
            color: 'text-gt-blue',
          },
        ].map(({ label, value, icon, color }) => (
          <Panel key={label}>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className={color}>{icon}</div>
              <div>
                <div className="text-[10px] font-mono text-gt-muted uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-xl font-extrabold font-mono ${color}`}>{value}</div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <VolumeChart />
        <ActionDistributionChart />
      </div>

      <FraudHeatmap />
    </div>
  );
}
