'use client';

import React from 'react';
import { Panel, PanelHeader } from '@/components/shared/ui';
import { useStore } from '@/lib/store';

export default function AgentInsightsCard() {
  const { reasoningLog } = useStore();
  const latest = reasoningLog[0];

  return (
    <Panel>
      <PanelHeader title="Agent Insights" />
      <div className="px-4 py-4">
        {latest ? (
          <>
            <div className="text-[12px] font-bold text-gt-text">{latest.stage.toUpperCase()} — {latest.txnId}</div>
            <p className="text-[11px] text-gt-muted mt-2 line-clamp-3">{latest.message}</p>
            <div className="mt-3">
              <button className="px-3 py-1 text-[11px] font-mono rounded bg-gt-accent text-white">View full analysis</button>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-gt-muted">No insights yet</div>
        )}
      </div>
    </Panel>
  );
}
