'use client';

import React from 'react';
import { cn, getRiskBarColor } from '@/lib/utils';

// ── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}
export function Badge({ children, className, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-bold uppercase tracking-wider border rounded',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Panel ────────────────────────────────────────────────────
interface PanelProps {
  children: React.ReactNode;
  className?: string;
}
export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn(
        'bg-gt-surface border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}
export function PanelHeader({ title, action, icon }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-gt-text font-display">
        {icon && <span className="text-gt-muted">{icon}</span>}
        {title}
      </div>
      {action && <div className="text-[11px] font-mono text-gt-accent">{action}</div>}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  accent: 'green' | 'blue' | 'red' | 'amber';
}
const ACCENT_MAP = {
  green: {
    bar:   'bg-gt-accent',
    value: 'text-gt-accent',
    delta: 'text-gt-accent',
  },
  blue: {
    bar:   'bg-gt-blue',
    value: 'text-gt-blue',
    delta: 'text-gt-blue',
  },
  red: {
    bar:   'bg-gt-danger',
    value: 'text-gt-danger',
    delta: 'text-gt-danger',
  },
  amber: {
    bar:   'bg-gt-warn',
    value: 'text-gt-warn',
    delta: 'text-gt-warn',
  },
};
export function StatCard({ label, value, delta, accent }: StatCardProps) {
  const a = ACCENT_MAP[accent];
  return (
    <Panel className="relative">
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', a.bar)} />
      <div className="px-4 py-4">
        <p className="text-[11px] font-mono text-gt-muted uppercase tracking-wider mb-2">{label}</p>
        <p className={cn('text-3xl font-extrabold font-display tracking-tight leading-none mb-1', a.value)}>
          {value}
        </p>
        {delta && (
          <p className="text-[11px] font-mono text-gt-muted">
            <span className={a.delta}>{delta}</span>
          </p>
        )}
      </div>
    </Panel>
  );
}

// ── Risk Bar ─────────────────────────────────────────────────
interface RiskBarProps {
  score: number;
  showLabel?: boolean;
  width?: string;
}
export function RiskBar({ score, showLabel = true, width = '60px' }: RiskBarProps) {
  const color = getRiskBarColor(score);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="h-1 rounded-full bg-gt-dim overflow-hidden" style={{ width }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="text-[10px] font-mono text-gt-muted">{score}/100</span>
      )}
    </div>
  );
}

// ── Pulse Dot ────────────────────────────────────────────────
interface PulseDotProps {
  color?: string;
  size?: number;
}
export function PulseDot({ color = '#00e5a0', size = 6 }: PulseDotProps) {
  return (
    <span
      className="inline-block rounded-full animate-pulse-slow"
      style={{ width: size, height: size, background: color }}
    />
  );
}

// ── Typing Indicator ─────────────────────────────────────────
export function TypingIndicator() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-gt-blue"
          style={{ animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%,60%,100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-gt-muted text-sm font-mono">
      {message}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ color: 'var(--gt-accent)' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
