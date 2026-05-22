import { clsx, type ClassValue } from 'clsx';
import type { TransactionStatus, AlertSeverity, AgentAction } from './types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ── Risk Score Helpers ───────────────────────────────────────
export function getRiskColor(score: number | null): string {
  if (score === null) return 'text-gt-muted';
  if (score >= 80) return 'text-gt-danger';
  if (score >= 65) return 'text-orange-400';
  if (score >= 50) return 'text-gt-warn';
  return 'text-gt-accent';
}

export function getRiskBg(score: number | null): string {
  if (score === null) return 'bg-gt-dim';
  if (score >= 80) return 'bg-gt-danger/10 border-gt-danger/25';
  if (score >= 65) return 'bg-orange-400/10 border-orange-400/25';
  if (score >= 50) return 'bg-gt-warn/10 border-gt-warn/25';
  return 'bg-gt-accent/10 border-gt-accent/25';
}

export function getRiskBarColor(score: number): string {
  if (score >= 80) return '#ff3b5c';
  if (score >= 65) return '#ff6b35';
  if (score >= 50) return '#ffb43a';
  return '#00e5a0';
}

export function getRiskLabel(score: number | null): string {
  if (score === null) return 'Pending';
  if (score >= 90) return 'Critical';
  if (score >= 80) return 'High Risk';
  if (score >= 65) return 'Suspicious';
  if (score >= 50) return 'Flagged';
  if (score >= 30) return 'Elevated';
  return 'Low Risk';
}

// ── Status Badge ─────────────────────────────────────────────
export const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending:      'bg-gt-blue/10 text-gt-blue border-gt-blue/20',
  cleared:      'bg-gt-accent/10 text-gt-accent border-gt-accent/20',
  flagged:      'bg-gt-warn/10 text-gt-warn border-gt-warn/20',
  blocked:      'bg-gt-danger/10 text-gt-danger border-gt-danger/20',
  frozen:       'bg-purple-400/10 text-purple-400 border-purple-400/20',
  under_review: 'bg-gt-blue/10 text-gt-blue border-gt-blue/20',
  approved:     'bg-gt-accent/10 text-gt-accent border-gt-accent/20',
  rejected:     'bg-gt-danger/10 text-gt-danger border-gt-danger/20',
};

export const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  low:      'bg-gt-accent/10 text-gt-accent border-gt-accent/20',
  medium:   'bg-gt-warn/10 text-gt-warn border-gt-warn/20',
  high:     'bg-orange-400/10 text-orange-400 border-orange-400/20',
  critical: 'bg-gt-danger/10 text-gt-danger border-gt-danger/20',
};

export const ACTION_STYLES: Record<string, string> = {
  clear:          'bg-gt-accent/10 text-gt-accent',
  flag:           'bg-gt-warn/10 text-gt-warn',
  block:          'bg-gt-danger/10 text-gt-danger',
  freeze:         'bg-purple-400/10 text-purple-400',
  escalate:       'bg-red-600/10 text-red-400',
  request_review: 'bg-gt-blue/10 text-gt-blue',
};

// ── Formatters ───────────────────────────────────────────────
export function formatAmount(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateString).toLocaleDateString();
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function maskAccountId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}****${id.slice(-4)}`;
}

export function severityToThreatScore(severity: AlertSeverity): number {
  return { low: 20, medium: 50, high: 75, critical: 95 }[severity] ?? 0;
}
