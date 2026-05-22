'use client';

import React from 'react';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { acknowledgeAlert, resolveAlert } from '@/lib/api';
import { SEVERITY_STYLES, formatRelativeTime, maskAccountId } from '@/lib/utils';
import type { FraudAlert } from '@/lib/types';
import { ShieldAlert, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface AlertRowProps {
  alert: FraudAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

function AlertRow({ alert, onAcknowledge, onResolve }: AlertRowProps) {
  const isOpen = alert.status === 'open';

  const borderAccent =
    alert.severity === 'critical' ? 'border-l-[#ff3b5c]' :
    alert.severity === 'high'     ? 'border-l-orange-400' : '';

  return (
    <div
      className={`px-4 py-3 border-b border-[rgba(255,255,255,0.05)] transition-all animate-slide-in border-l-2 ${borderAccent}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={SEVERITY_STYLES[alert.severity]}>{alert.severity}</Badge>
            <span className="text-[11px] font-mono text-gt-muted">{alert.alertId}</span>
            <span className="text-[10px] font-mono text-gt-dim ml-auto">
              {formatRelativeTime(alert.createdAt)}
            </span>
          </div>

          <div className="text-[12px] font-mono font-bold text-gt-text mb-1">
            {maskAccountId(alert.accountId)} — Score {alert.fraudScore}/100
          </div>

          {alert.geminiExplanation && (
            <p className="text-[11px] text-gt-muted leading-relaxed line-clamp-2">
              {alert.geminiExplanation}
            </p>
          )}

          <div className="flex flex-wrap gap-1 mt-1.5">
            {alert.triggerReasons.slice(0, 3).map((r) => (
              <span
                key={r}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gt-surface2 text-gt-muted border border-[rgba(255,255,255,0.06)]"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        {isOpen && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => onAcknowledge(alert.alertId)}
              aria-label="Acknowledge alert"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono text-gt-blue bg-gt-blue/10 border border-gt-blue/20 rounded hover:bg-gt-blue/20 transition-colors"
            >
              <Check size={11} /> ACK
            </button>
            <button
              onClick={() => onResolve(alert.alertId)}
              aria-label="Mark as false positive"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono text-gt-accent bg-gt-accent/10 border border-gt-accent/20 rounded hover:bg-gt-accent/20 transition-colors"
            >
              <X size={11} /> FP
            </button>
          </div>
        )}

        {!isOpen && (
          <Badge className="bg-gt-accent/10 text-gt-accent border-gt-accent/20 flex-shrink-0">
            {alert.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function AlertsPanel() {
  const { activeAlerts, dismissAlert } = useStore();
  const openAlerts = activeAlerts.filter(
    (a) => a.status === 'open' || a.status === 'acknowledged'
  );

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      toast.success('Alert acknowledged');
    } catch {
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await resolveAlert(alertId, 'false_positive');
      dismissAlert(alertId);
      toast.success('Marked as false positive');
    } catch {
      toast.error('Failed to resolve alert');
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Active Alerts"
        icon={<ShieldAlert size={15} />}
        action={
          openAlerts.length > 0
            ? <span className="text-gt-danger">{openAlerts.length} OPEN</span>
            : <span className="text-gt-accent">ALL CLEAR</span>
        }
      />
      <div>
        {openAlerts.length === 0
          ? <EmptyState message="No active alerts — system nominal" />
          : openAlerts.slice(0, 8).map((alert) => (
              <AlertRow
                key={alert.alertId}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
              />
            ))
        }
      </div>
    </Panel>
  );
}
