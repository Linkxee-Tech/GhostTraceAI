'use client';

import React, { useState } from 'react';
import { Panel, PanelHeader, Badge, EmptyState, Spinner } from '@/components/shared/ui';
import { fetchAlerts, acknowledgeAlert, resolveAlert } from '@/lib/api';
import { SEVERITY_STYLES, getRiskColor, formatRelativeTime, maskAccountId } from '@/lib/utils';
import type { FraudAlert } from '@/lib/types';
import { ShieldAlert, Check, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import useSWR from 'swr';
import toast from 'react-hot-toast';

const SEVERITY_FILTERS = [
  { label: 'All',      value: '' },
  { label: 'Critical', value: 'critical' },
  { label: 'High',     value: 'high' },
  { label: 'Medium',   value: 'medium' },
  { label: 'Low',      value: 'low' },
];

const STATUS_FILTERS = [
  { label: 'Open',         value: 'open' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'Resolved',     value: 'resolved' },
  { label: 'False Positive', value: 'false_positive' },
];

// ── Alert Card ─────────────────────────────────────────────────
function AlertCard({ alert, onRefresh }: { alert: FraudAlert; onRefresh: () => void }) {
  const [expanded,   setExpanded]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { dismissAlert, activeAlerts, setActiveAlerts, currentUser } = useStore();
  const isDemoUser = currentUser?.accountType === 'demo' || (currentUser?.email || '').toLowerCase().includes('demo');

  const handleAck = async () => {
    if (isDemoUser) {
      setActiveAlerts(activeAlerts.map((item) =>
        item.alertId === alert.alertId
          ? { ...item, status: 'acknowledged', acknowledgedBy: 'demo', acknowledgedAt: new Date().toISOString() }
          : item
      ));
      toast.success('Alert acknowledged');
      onRefresh();
      return;
    }

    try {
      setSubmitting(true);
      await acknowledgeAlert(alert.alertId);
      toast.success('Alert acknowledged');
      onRefresh();
    } catch { toast.error('Failed to acknowledge'); }
    finally { setSubmitting(false); }
  };

  const handleResolve = async (outcome: string) => {
    if (isDemoUser) {
      setActiveAlerts(activeAlerts.filter((item) => item.alertId !== alert.alertId));
      toast.success(`Resolved as ${outcome.replace(/_/g, ' ')}`);
      onRefresh();
      return;
    }

    try {
      setSubmitting(true);
      await resolveAlert(alert.alertId, outcome);
      toast.success(`Resolved as ${outcome.replace(/_/g, ' ')}`);
      dismissAlert(alert.alertId);
      onRefresh();
    } catch { toast.error('Failed to resolve'); }
    finally { setSubmitting(false); }
  };

  const borderColor =
    alert.severity === 'critical' ? '#ff3b5c' :
    alert.severity === 'high'     ? '#fb923c' :
    alert.severity === 'medium'   ? '#ffb43a' : '#00e5a0';

  return (
    <div
      className="border-b border-[rgba(255,255,255,0.05)]"
      style={{ borderLeft: `2px solid ${borderColor}` }}
    >
      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4 hover:bg-gt-surface2 transition-colors">

        {/* Score ring */}
        <div
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0"
          style={{ borderColor: borderColor }}
          aria-label={`Fraud score ${alert.fraudScore}`}
        >
          <span className={`text-sm font-extrabold font-mono ${getRiskColor(alert.fraudScore)}`}>
            {alert.fraudScore}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={SEVERITY_STYLES[alert.severity]}>{alert.severity}</Badge>
            <span className="text-[11px] font-mono text-gt-dim">{alert.alertId}</span>
            <span className="text-[11px] font-mono text-gt-muted">{maskAccountId(alert.accountId)}</span>
            <span className="ml-auto text-[10px] font-mono text-gt-dim">{formatRelativeTime(alert.createdAt)}</span>
          </div>

          {/* AI explanation */}
          <p className="text-[12px] text-gt-text leading-relaxed mb-2">{alert.geminiExplanation}</p>

          {/* Risk factor mini-bars */}
          {alert.riskFactors && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {Object.entries(alert.riskFactors).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between text-[9px] font-mono text-gt-dim mb-0.5">
                    <span>{key.replace(/([A-Z])/g, ' $1').replace('Score', '').trim()}</span>
                    <span>{val}</span>
                  </div>
                  <div className="h-1 rounded-full bg-gt-dim overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${val}%`,
                        background: Number(val) >= 80 ? '#ff3b5c' : Number(val) >= 50 ? '#ffb43a' : '#00e5a0',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trigger reasons */}
          <div className="flex flex-wrap gap-1.5">
            {alert.triggerReasons.map((r) => (
              <span key={r} className="text-[10px] font-mono px-1.5 py-0.5 bg-gt-surface2 text-gt-muted border border-[rgba(255,255,255,0.06)] rounded">
                {r}
              </span>
            ))}
          </div>

          {/* Expanded detail section */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)] text-[11px] font-mono text-gt-muted space-y-1">
              <div><span className="text-gt-dim">Transaction:</span> {alert.txnId}</div>
              <div><span className="text-gt-dim">Agent Action:</span> {alert.agentAction}</div>
              <div><span className="text-gt-dim">Confidence:</span> {Math.round(alert.fraudConfidence * 100)}%</div>
              <div><span className="text-gt-dim">Action Time:</span> {formatRelativeTime(alert.agentActionAt)}</div>
            </div>
          )}
        </div>

        {/* Actions column */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {alert.status === 'open' && (
            <>
              <button
                onClick={handleAck} disabled={submitting} aria-label="Acknowledge"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-gt-blue bg-gt-blue/10 border border-gt-blue/20 rounded hover:bg-gt-blue/20 transition-colors disabled:opacity-50"
              >
                <Check size={11} /> ACK
              </button>
              <button
                onClick={() => handleResolve('false_positive')} disabled={submitting} aria-label="False positive"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-gt-accent bg-gt-accent/10 border border-gt-accent/20 rounded hover:bg-gt-accent/20 transition-colors disabled:opacity-50"
              >
                <X size={11} /> FALSE POS
              </button>
              <button
                onClick={() => handleResolve('confirmed_fraud')} disabled={submitting} aria-label="Confirm fraud"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-gt-danger bg-gt-danger/10 border border-gt-danger/20 rounded hover:bg-gt-danger/20 transition-colors disabled:opacity-50"
              >
                <AlertTriangle size={11} /> CONFIRM
              </button>
            </>
          )}
          {alert.status !== 'open' && (
            <Badge className="bg-gt-accent/10 text-gt-accent border-gt-accent/20">{alert.status}</Badge>
          )}
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            className="flex items-center justify-center p-1.5 rounded hover:bg-gt-surface2 transition-colors"
          >
            {expanded
              ? <ChevronUp size={14} className="text-gt-muted" />
              : <ChevronDown size={14} className="text-gt-muted" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full Alerts Page ──────────────────────────────────────────
export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('open');

  // Store-seeded demo data as fallback
  const { activeAlerts: storeAlerts, currentUser } = useStore();
  const isDemoUser =
    currentUser?.accountType === 'demo' ||
    (currentUser?.email || '').toLowerCase().includes('demo');

  const { data, isLoading, mutate } = useSWR(
    ['alerts', severityFilter, statusFilter],
    () => fetchAlerts({ severity: severityFilter || undefined, status: statusFilter || undefined, limit: 30 }),
    { refreshInterval: 5000, revalidateOnFocus: false }
  );

  // Use API data whenever a response exists (even empty), and only fall back to store when API is unavailable.
  const hasApiResponse = Array.isArray(data?.data);
  const fallbackAlerts = storeAlerts.filter((a) => {
        const matchSeverity = !severityFilter || a.severity === severityFilter;
        const matchStatus   = !statusFilter   || a.status   === statusFilter;
        return matchSeverity && matchStatus;
      });
  const alerts: FraudAlert[] = isDemoUser
    ? fallbackAlerts
    : (hasApiResponse ? data!.data : fallbackAlerts);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader
          title={`Fraud Alerts (${alerts.length})`}
          icon={<ShieldAlert size={15} />}
          action={
            <span className={isDemoUser ? 'text-gt-warn' : (isLoading ? 'text-gt-muted' : 'text-gt-accent')}>
              {isDemoUser ? 'DEMO MODE' : (isLoading ? 'SYNCING…' : 'LIVE')}
            </span>
          }
        />

        {/* Filter bar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[rgba(255,255,255,0.05)] flex-wrap">
          {/* Severity filters */}
          <div className="flex gap-1 flex-wrap">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSeverityFilter(f.value)}
                aria-pressed={severityFilter === f.value}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors border ${
                  severityFilter === f.value
                    ? 'bg-gt-accent/15 text-gt-accent border-gt-accent/30'
                    : 'text-gt-muted border-[rgba(255,255,255,0.06)] hover:text-gt-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-gt-dim hidden sm:block" />
          {/* Status filters */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                aria-pressed={statusFilter === f.value}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors border ${
                  statusFilter === f.value
                    ? 'bg-gt-blue/15 text-gt-blue border-gt-blue/30'
                    : 'text-gt-muted border-[rgba(255,255,255,0.06)] hover:text-gt-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alert list */}
        {isLoading && !alerts.length
          ? <div className="flex justify-center py-12"><Spinner /></div>
          : alerts.length === 0
          ? <EmptyState message="No alerts match the current filters" />
          : alerts.map((alert) => (
              <AlertCard key={alert.alertId} alert={alert} onRefresh={() => mutate()} />
            ))
        }
      </Panel>
    </div>
  );
}
