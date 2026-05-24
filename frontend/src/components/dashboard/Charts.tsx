'use client';

import React, { useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { Panel, PanelHeader } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { BarChart3, PieChart as PieIcon, Activity } from 'lucide-react';
import type { Transaction } from '@/lib/types';

// ── Custom dark tooltip ───────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gt-surface2 border border-[rgba(255,255,255,0.12)] rounded-lg px-3 py-2 text-[11px] font-mono shadow-xl">
      <div className="text-gt-muted mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Volume vs Fraud Area Chart ────────────────────────────────
function buildVolumeData(transactions: Transaction[]) {
  const buckets: Record<string, { volume: number; fraud: number }> = {};
  const now = Date.now();

  for (let i = 11; i >= 0; i--) {
    const t = new Date(now - i * 3_600_000);
    const key = `${String(t.getHours()).padStart(2, '0')}:00`;
    buckets[key] = { volume: 0, fraud: 0 };
  }

  transactions.forEach((txn) => {
    const t = new Date(txn.createdAt);
    const key = `${String(t.getHours()).padStart(2, '0')}:00`;
    if (buckets[key]) {
      buckets[key].volume++;
      if (txn.fraudScore !== null && txn.fraudScore >= 80) buckets[key].fraud++;
    }
  });

  return Object.entries(buckets).map(([hour, v]) => ({ hour, ...v }));
}

export function VolumeChart() {
  const { liveTransactions } = useStore();
  const data = useMemo(() => buildVolumeData(liveTransactions), [liveTransactions]);

  return (
    <Panel>
      <PanelHeader title="Transaction Volume vs Fraud Rate" icon={<Activity size={15} />} />
      <div className="px-2 pb-4 pt-2">
        <div className="flex gap-4 px-3 mb-3 text-[11px] font-mono text-gt-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-gt-blue inline-block" />
            Volume
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-gt-danger inline-block" style={{ borderTop: '2px dashed #ff3b5c', background: 'none', height: 0 }} />
            Fraud
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0095ff" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0095ff" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ff3b5c" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#6b7a8d', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7a8d', fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<DarkTooltip />} />
            <Area
              type="monotone" dataKey="volume"
              stroke="#0095ff" strokeWidth={2}
              fill="url(#volGrad)" dot={false} name="Volume"
            />
            <Area
              type="monotone" dataKey="fraud"
              stroke="#ff3b5c" strokeWidth={2}
              fill="url(#fraudGrad)" strokeDasharray="4 2" dot={false} name="Fraud"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ── Action Distribution Donut ─────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  cleared: '#00e5a0',
  flagged: '#ffb43a',
  blocked: '#ff3b5c',
  review:  '#0095ff',
  frozen:  '#b49bff',
};

export function ActionDistributionChart() {
  const { liveTransactions } = useStore();

  const data = useMemo(() => {
    const counts = { cleared: 0, flagged: 0, blocked: 0, review: 0, frozen: 0 };
    liveTransactions.forEach((t) => {
      if      (t.status === 'cleared' || t.status === 'approved')  counts.cleared++;
      else if (t.status === 'flagged')                             counts.flagged++;
      else if (t.status === 'blocked' || t.status === 'rejected')  counts.blocked++;
      else if (t.status === 'under_review')                        counts.review++;
      else if (t.status === 'frozen')                              counts.frozen++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [liveTransactions]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Panel>
      <PanelHeader title="Action Distribution" icon={<PieIcon size={15} />} />
      <div className="px-4 pb-4 pt-2">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3 text-[11px] font-mono text-gt-muted">
          {data.map((d) => (
            <span key={d.name} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-sm inline-block flex-shrink-0"
                style={{ background: ACTION_COLORS[d.name] ?? '#666' }}
              />
              {d.name}&nbsp;
              <span className="font-bold" style={{ color: ACTION_COLORS[d.name] ?? '#666' }}>
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </span>
          ))}
        </div>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gt-muted text-[11px] font-mono">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={ACTION_COLORS[entry.name] ?? '#666'}
                  />
                ))}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

// ── Risk Score Distribution Donut ────────────────────────────
export function RiskDistributionChart() {
  const { liveTransactions } = useStore();

  const buckets = React.useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 } as Record<string, number>;
    liveTransactions.forEach((t) => {
      const s = t.fraudScore ?? -1;
      if (s < 0) return;
      if (s < 25) counts.low++;
      else if (s < 50) counts.medium++;
      else if (s < 80) counts.high++;
      else counts.critical++;
    });
    return counts;
  }, [liveTransactions]);

  const data = Object.entries(buckets).map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, d) => s + d.value, 0);

  const COLORS: Record<string, string> = {
    low: '#00e5a0',
    medium: '#0095ff',
    high: '#ffb43a',
    critical: '#ff3b5c',
  };

  return (
    <Panel>
      <PanelHeader title="Risk Score Distribution" icon={<PieIcon size={15} />} />
      <div className="px-4 pb-4 pt-2">
        {total === 0 ? (
          <div className="flex items-center justify-center h-40 text-gt-muted text-[11px] font-mono">No scored transactions yet</div>
        ) : (
          <div className="relative flex items-center justify-center" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <div className="text-2xl font-extrabold font-display">{total}</div>
              <div className="text-[11px] font-mono text-gt-muted">Transactions</div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── 24h Fraud Activity Heatmap ────────────────────────────────
export function FraudHeatmap() {
  const { liveTransactions } = useStore();

  const heatData = useMemo(() => {
    const buckets = new Array(24).fill(0) as number[];
    liveTransactions.forEach((t) => {
      if (t.fraudScore !== null && t.fraudScore >= 50) {
        const h = new Date(t.createdAt).getHours();
        buckets[h]++;
      }
    });
    return buckets;
  }, [liveTransactions]);

  const max = Math.max(...heatData, 1);

  return (
    <Panel>
      <PanelHeader title="24h Fraud Activity Heatmap" icon={<BarChart3 size={15} />} />
      <div className="px-4 pb-4">
        <div className="flex justify-between text-[9px] font-mono text-gt-dim mb-1.5 mt-1">
          {['00', '06', '12', '18', '23'].map((h) => <span key={h}>{h}:00</span>)}
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}
          role="img"
          aria-label="24-hour fraud activity heatmap"
        >
          {heatData.map((val, i) => {
            const intensity = val / max;
            const r = Math.round(255 * Math.min(1, intensity * 2));
            const g = Math.round(229 * Math.max(0, 1 - intensity));
            const a = 0.1 + intensity * 0.85;
            return (
              <div
                key={i}
                title={`${String(i).padStart(2, '0')}:00 — ${val} events`}
                className="aspect-square rounded-sm transition-transform hover:scale-125 cursor-default"
                style={{ background: `rgba(${r},${g},100,${a})` }}
                aria-label={`Hour ${i}: ${val} fraud events`}
              />
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
