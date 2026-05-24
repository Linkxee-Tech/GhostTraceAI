'use client';

import React from 'react';
import { Panel, PanelHeader, Badge } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { Activity } from 'lucide-react';

export default function AgentStatusCard() {
  const { wsConnected } = useStore();
  return (
    <Panel>
      <PanelHeader title="AI Agent Status" icon={<Activity size={15} />} />
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg bg-gt-surface2 flex items-center justify-center">🤖</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold">Agent</div>
            <Badge className={wsConnected ? 'bg-gt-accent/10 text-gt-accent border-gt-accent/20' : 'bg-gt-muted/5 text-gt-muted'}>
              {wsConnected ? 'Active' : 'Idle'}
            </Badge>
          </div>
          <div className="text-[11px] text-gt-muted mt-1">Monitoring transactions 24/7 · all systems normal</div>
        </div>
      </div>
    </Panel>
  );
}
