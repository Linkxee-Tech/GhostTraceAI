'use client';

import React from 'react';
import { Panel, PanelHeader, Badge } from '@/components/shared/ui';
import { FileText, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { useStore } from '@/lib/store';

const MOCK_CASES = [
  { id: 'CAS-001', title: 'High Velocity Transfers - Account #88392', status: 'Open', priority: 'High', time: '10 mins ago' },
  { id: 'CAS-002', title: 'Impossible Travel - Login from RU', status: 'In Progress', priority: 'Critical', time: '2 hours ago' },
  { id: 'CAS-003', title: 'Device Fingerprint Mismatch', status: 'Resolved', priority: 'Medium', time: '1 day ago' },
];

export default function RecentCasesPanel() {
  const router = useRouter();
  const { setActiveTab } = useStore();

  const handleViewAll = () => {
    setActiveTab('cases');
    router.push('/cases');
  };

  return (
    <Panel>
      <PanelHeader 
        title="Recent Investigations" 
        icon={<FileText size={15} />} 
        action={
          <button onClick={handleViewAll} className="text-[11px] font-mono text-gt-accent hover:underline flex items-center">
            View All <ChevronRight size={12} />
          </button>
        }
      />
      <div className="flex flex-col">
        {MOCK_CASES.map((c, i) => (
          <div key={c.id} className={`px-4 py-3 flex items-center justify-between hover:bg-gt-surface2 transition-colors cursor-pointer ${i !== MOCK_CASES.length - 1 ? 'border-b border-[rgba(255,255,255,0.04)]' : ''}`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono font-bold text-gt-text">{c.id}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  c.priority === 'Critical' ? 'bg-gt-danger/10 text-gt-danger' :
                  c.priority === 'High' ? 'bg-gt-warn/10 text-gt-warn' :
                  'bg-gt-blue/10 text-gt-blue'
                }`}>
                  {c.priority}
                </span>
              </div>
              <div className="text-[12px] text-gt-muted truncate max-w-[200px] sm:max-w-[300px]">{c.title}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge size="sm" className={
                c.status === 'Open' ? 'border-gt-warn text-gt-warn' :
                c.status === 'In Progress' ? 'border-gt-blue text-gt-blue' :
                'border-gt-accent text-gt-accent'
              }>{c.status}</Badge>
              <span className="text-[10px] font-mono text-gt-dim">{c.time}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
