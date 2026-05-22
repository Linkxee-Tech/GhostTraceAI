'use client';

import React from 'react';
import { Panel, PanelHeader, TypingIndicator, EmptyState } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { formatRelativeTime } from '@/lib/utils';
import { Brain, CheckCircle, AlertCircle, Zap, Shield, Bell, ArrowUpCircle } from 'lucide-react';

// ── Agent Reasoning Feed ─────────────────────────────────────
type Stage = 'planning' | 'reasoning' | 'acting';

const STAGE_ICON: Record<Stage, React.ReactNode> = {
  planning:  <Brain size={13} className="text-gt-blue" />,
  reasoning: <TypingIndicator />,
  acting:    <Zap size={13} className="text-gt-warn" />,
};

const STAGE_COLOR: Record<Stage, string> = {
  planning:  'text-gt-blue',
  reasoning: 'text-gt-blue',
  acting:    'text-gt-warn',
};

export function AgentReasoningFeed() {
  const { reasoningLog } = useStore();

  return (
    <Panel>
      <PanelHeader
        title="Gemini Reasoning"
        icon={<Brain size={15} />}
        action={<span className="text-gt-blue">LIVE</span>}
      />
      <div>
        {reasoningLog.length === 0
          ? <EmptyState message="Agent idle — awaiting transactions" />
          : reasoningLog.slice(0, 8).map((entry, i) => (
              <div
                key={`${entry.txnId}-${i}`}
                className="flex items-start gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)] animate-slide-in"
              >
                <div className="w-7 h-7 rounded-full bg-gt-surface2 border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {STAGE_ICON[entry.stage as Stage] ?? <Brain size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[12px] font-bold ${STAGE_COLOR[entry.stage as Stage] ?? 'text-gt-text'}`}>
                      {entry.stage.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-mono text-gt-dim truncate">{entry.txnId}</span>
                  </div>
                  <p className="text-[11px] text-gt-muted font-mono mt-0.5 leading-relaxed">{entry.message}</p>
                  {entry.fraudScore !== undefined && (
                    <span className="text-[10px] font-mono text-gt-warn">Score: {entry.fraudScore}</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-gt-dim flex-shrink-0">
                  {formatRelativeTime(entry.timestamp.toISOString())}
                </span>
              </div>
            ))
        }
      </div>
    </Panel>
  );
}

// ── Agent Actions Log ─────────────────────────────────────────
type ActionType = 'clear' | 'flag' | 'block' | 'freeze' | 'escalate' | 'request_review';

const ACTION_CONFIG: Record<ActionType, { icon: React.ReactNode; color: string; bg: string }> = {
  clear:          { icon: <CheckCircle size={13} />,   color: 'text-gt-accent',    bg: 'bg-gt-accent/10' },
  flag:           { icon: <AlertCircle size={13} />,   color: 'text-gt-warn',      bg: 'bg-gt-warn/10' },
  block:          { icon: <Shield size={13} />,        color: 'text-gt-danger',    bg: 'bg-gt-danger/10' },
  freeze:         { icon: <Shield size={13} />,        color: 'text-purple-400',   bg: 'bg-purple-400/10' },
  escalate:       { icon: <ArrowUpCircle size={13} />, color: 'text-red-400',      bg: 'bg-red-400/10' },
  request_review: { icon: <Bell size={13} />,          color: 'text-gt-blue',      bg: 'bg-gt-blue/10' },
};

export function AgentActionsLog({ limit = 8 }: { limit?: number }) {
  const { agentActions } = useStore();

  return (
    <Panel>
      <PanelHeader
        title="Agent Actions"
        icon={<Zap size={15} />}
        action={`${agentActions.length} executed`}
      />
      <div>
        {agentActions.length === 0
          ? <EmptyState message="No actions executed yet" />
          : agentActions.slice(0, limit).map((action) => {
              const cfg = ACTION_CONFIG[action.actionType as ActionType] ?? ACTION_CONFIG.flag;
              return (
                <div
                  key={action.actionId}
                  className="flex items-start gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)] animate-slide-in"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-gt-text capitalize">
                      {action.actionType.replace('_', ' ')} — {action.txnId}
                    </div>
                    <div className="text-[11px] font-mono text-gt-muted mt-0.5 line-clamp-1">
                      Score {action.fraudScoreAtAction}/100 · {Math.round(action.confidenceAtAction * 100)}% confidence · {action.executionLatencyMs}ms
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-gt-dim flex-shrink-0">
                    {formatRelativeTime(action.executedAt)}
                  </span>
                </div>
              );
            })
        }
        {agentActions.length > limit && (
          <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.05)] text-[10px] font-mono text-gt-dim text-center">
            Showing {limit} of {agentActions.length} actions
          </div>
        )}
      </div>
    </Panel>
  );
}
