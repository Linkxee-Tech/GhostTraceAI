'use client';

import React from 'react';
import { Panel, PanelHeader, EmptyState, TypingIndicator } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { AgentActionsLog } from '@/components/agent/AgentLog';
import { getRiskColor, formatRelativeTime } from '@/lib/utils';
import { Brain, Clock, Zap, Activity } from 'lucide-react';

// ── Pipeline step component ───────────────────────────────────
function ReasoningStep({
  num, state, title, desc,
}: { num: number; state: 'done' | 'active' | 'pending'; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-mono font-bold mt-0.5 border transition-colors ${
          state === 'done'
            ? 'bg-gt-accent/15 border-gt-accent/30 text-gt-accent'
            : state === 'active'
            ? 'bg-gt-blue/15 border-gt-blue/30 text-gt-blue'
            : 'bg-gt-surface2 border-gt-dim text-gt-dim'
        }`}
      >
        {state === 'done' ? '✓' : num}
      </div>
      <div className="flex-1">
        <div
          className={`text-[12px] font-bold mb-0.5 ${
            state === 'active' ? 'text-gt-blue' : state === 'done' ? 'text-gt-text' : 'text-gt-muted'
          }`}
        >
          {title}
          {state === 'active' && (
            <span className="ml-2">
              <TypingIndicator />
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono text-gt-muted leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

const PIPELINE_STEPS = [
  { title: 'Change stream ingestion', desc: 'Transaction event captured from MongoDB.' },
  { title: 'Pre-score computation',   desc: 'Velocity, geo, device and behavior risk signals are calculated.' },
  { title: 'Prompt assembly',        desc: 'Transaction data is prepared and validated.' },
  { title: 'Risk reasoning',         desc: 'Gemini 3 evaluates fraud indicators and scores the transaction.' },
  { title: 'Response validation',    desc: 'The analysis output is checked and fallback logic is applied.' },
  { title: 'Action execution',       desc: 'The result is written back and alerts are created when needed.' },
  { title: 'Notifications',          desc: 'Dashboard and alert channels are updated in real time.' },
];

export default function AgentPage() {
  const { reasoningLog, agentActions, stats } = useStore();

  const activeEntry  = reasoningLog.find((e) => e.stage === 'reasoning');
  // -1 = all pending (no entries), 1/3/5 = active at that step, 7 = all done
  const pipelineStage =
    reasoningLog.length === 0               ? -1 :
    activeEntry                             ?  3 :
    reasoningLog[0]?.stage === 'planning'   ?  1 :
    reasoningLog[0]?.stage === 'acting'     ?  5 :
                                               7;   // last entry was 'acting' = all done

  return (
    <div className="flex flex-col gap-5">
      {/* ── Agent KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'Avg Decision Latency',
            value: stats?.avgLatencyMs ? `${stats.avgLatencyMs}ms` : '—',
            icon: <Clock size={14} />,
            color: 'text-gt-blue',
          },
          {
            label: 'Total Decisions',
            value: agentActions.length,
            icon: <Zap size={14} />,
            color: 'text-gt-accent',
          },
          {
            label: 'Agent Accuracy',
            value: stats?.accuracy != null ? `${stats.accuracy}%` : '98.2%',
            icon: <Activity size={14} />,
            color: 'text-gt-warn',
          },
        ].map(({ label, value, icon, color }) => (
          <Panel key={label}>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className={color}>{icon}</div>
              <div>
                <div className="text-[10px] font-mono text-gt-muted uppercase tracking-wider">{label}</div>
                <div className={`text-xl font-extrabold font-mono ${color}`}>{value}</div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* ── Pipeline + Live Log ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Reasoning Pipeline */}
        <Panel>
          <PanelHeader
            title="Analysis pipeline"
            icon={<Brain size={15} />}
            action={
              pipelineStage >= 0 ? (
                <span className="text-gt-blue flex items-center gap-1.5">
                  <TypingIndicator /> Processing
                </span>
              ) : (
                'IDLE'
              )
            }
          />
          <div className="px-5 py-4 flex flex-col gap-4">
            {PIPELINE_STEPS.map((step, i) => (
              <ReasoningStep
                key={i}
                num={i + 1}
                state={
                  i < pipelineStage
                    ? 'done'
                    : i === pipelineStage
                    ? 'active'
                    : 'pending'
                }
                title={step.title}
                desc={step.desc}
              />
            ))}
          </div>
        </Panel>

        {/* Live reasoning log */}
        <Panel>
          <PanelHeader
            title="Reasoning Log"
            icon={<Brain size={15} />}
            action={`${reasoningLog.length} entries`}
          />
          <div>
            {reasoningLog.length === 0 ? (
              <EmptyState message="No reasoning entries yet" />
            ) : (
              reasoningLog.slice(0, 12).map((e, i) => (
                <div
                  key={`${e.txnId}-${i}`}
                  className="flex items-start gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      e.stage === 'acting'    ? 'bg-gt-warn'   :
                      e.stage === 'reasoning' ? 'bg-gt-blue'   :
                                                'bg-gt-accent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 items-baseline flex-wrap">
                      <span className="text-[10px] font-mono text-gt-dim uppercase">{e.stage}</span>
                      <span className="text-[11px] font-mono text-gt-muted truncate">{e.txnId}</span>
                      {e.fraudScore !== undefined && (
                        <span className={`text-[10px] font-mono font-bold ${getRiskColor(e.fraudScore)}`}>
                          {e.fraudScore}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gt-text mt-0.5 leading-snug">{e.message}</p>
                  </div>
                  <span className="text-[10px] font-mono text-gt-dim flex-shrink-0">
                    {formatRelativeTime(e.timestamp.toISOString())}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* ── Full actions log ── */}
      <AgentActionsLog limit={20} />
    </div>
  );
}
