'use client';

import React, { useMemo } from 'react';
import { Panel, PanelHeader } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { getRiskBarColor } from '@/lib/utils';
import { Radar, BarChart3, Globe } from 'lucide-react';
import type { RiskFactors } from '@/lib/types';

// ── SVG arc helpers ──────────────────────────────────────────
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end   = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

// ── Threat Gauge ──────────────────────────────────────────────
export function ThreatGauge() {
  const { activeAlerts } = useStore();

  const threatScore = useMemo(() => {
    if (!activeAlerts.length) return 0;
    const open = activeAlerts.filter((a) => a.status === 'open');
    if (!open.length) return 10;
    return Math.round(open.reduce((s, a) => s + a.fraudScore, 0) / open.length);
  }, [activeAlerts]);

  const cx = 100; const cy = 100; const r = 75;
  const needle    = polarToCartesian(cx, cy, r - 5, -180 + threatScore * 1.8);
  const arcColor  =
    threatScore >= 80 ? '#ff3b5c' :
    threatScore >= 50 ? '#ffb43a' : '#00e5a0';

  return (
    <Panel>
      <PanelHeader title="Threat Level" icon={<Radar size={15} />} />
      <div className="flex flex-col items-center gap-2 px-4 py-5">
        <svg
          width="200" height="120" viewBox="0 0 200 120"
          role="img"
          aria-label={`Threat level ${threatScore} out of 100`}
        >
          {/* Track */}
          <path d={describeArc(cx, cy, r, -180, 0)} stroke="#1e2a36" strokeWidth="14" fill="none" strokeLinecap="round" />
          {/* Zone: green */}
          <path d={describeArc(cx, cy, r, -180, -60)} stroke="rgba(0,229,160,0.25)" strokeWidth="14" fill="none" />
          {/* Zone: amber */}
          <path d={describeArc(cx, cy, r, -60,   60)} stroke="rgba(255,180,58,0.25)" strokeWidth="14" fill="none" />
          {/* Zone: red */}
          <path d={describeArc(cx, cy, r, 60,   180)} stroke="rgba(255,59,92,0.2)"  strokeWidth="14" fill="none" />
          {/* Active fill */}
          {threatScore > 0 && (
            <path
              d={describeArc(cx, cy, r, -180, -180 + threatScore * 1.8)}
              stroke={arcColor} strokeWidth="14" fill="none" strokeLinecap="round"
            />
          )}
          {/* Needle */}
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={arcColor} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill={arcColor} />
          {/* Labels */}
          <text x="22"  y="116" fill="#3a4553" fontSize="9" fontFamily="monospace">LOW</text>
          <text x="87"  y="18"  fill="#3a4553" fontSize="9" fontFamily="monospace">MED</text>
          <text x="159" y="116" fill="#3a4553" fontSize="9" fontFamily="monospace">HIGH</text>
        </svg>
        <div className="text-4xl font-extrabold font-display tracking-tight" style={{ color: arcColor }}>
          {threatScore}
        </div>
        <div className="text-[11px] font-mono text-gt-muted tracking-widest uppercase">
          Threat Score
        </div>
      </div>
    </Panel>
  );
}

// ── Risk Factor Breakdown ─────────────────────────────────────
const FACTOR_LABELS: [keyof RiskFactors, string][] = [
  ['velocityScore',       'Velocity'],
  ['geoAnomalyScore',     'Geo Anomaly'],
  ['deviceTrustScore',    'Device Trust'],
  ['merchantRiskScore',   'Merchant Risk'],
  ['behavioralDriftScore','Behavioral Drift'],
];

export function RiskFactorBreakdown({ factors }: { factors?: RiskFactors }) {
  return (
    <Panel>
      <PanelHeader title="Risk Factors" icon={<BarChart3 size={15} />} />
      <div className="px-4 py-3 flex flex-col gap-3">
        {FACTOR_LABELS.map(([key, label]) => {
          const score = factors?.[key] ?? 0;
          const color = getRiskBarColor(score);
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-mono text-gt-muted">{label}</span>
                <span className="text-[12px] font-mono font-bold" style={{ color }}>{score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gt-dim overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%`, background: color }}
                  role="meter"
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={label}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Geo Anomaly Panel ──────────────────────────────────────────
interface GeoEntry { country: string; count: number; isAnomaly?: boolean; }

export function GeoAnomalyPanel({ entries }: { entries: GeoEntry[] }) {
  const max = Math.max(...entries.map((e) => e.count), 1);
  return (
    <Panel>
      <PanelHeader title="Geo Distribution" icon={<Globe size={15} />} />
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {entries.map((e) => (
          <div key={e.country} className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: e.isAnomaly ? '#ff3b5c' : '#00e5a0' }}
            />
            <span className="text-[12px] text-gt-text flex-1 truncate">{e.country}</span>
            <div className="w-20 h-1 rounded-full bg-gt-dim overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(e.count / max) * 100}%`,
                  background: e.isAnomaly ? '#ff3b5c' : '#00e5a0',
                }}
              />
            </div>
            <span className="text-[11px] font-mono text-gt-muted w-10 text-right">{e.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
