'use client';

import React from 'react';
import useSWR from 'swr';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/shared/ui';
import { FileText, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { useStore } from '@/lib/store';
import { fetchCases } from '@/lib/api';

export default function RecentCasesPanel() {
  const router = useRouter();
  const { setActiveTab } = useStore();

  const { data, error } = useSWR('cases', () => fetchCases().then((r) => r.data), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const handleViewAll = () => {
    setActiveTab('cases');
    router.push('/cases');
  };

  const cases = data || [];

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
        {error ? (
          <div className="p-6">
            <EmptyState message="Unable to load cases — demo data disabled. Check backend connection." />
          </div>
        ) : !data ? (
          <div className="p-6">
            <EmptyState message="Loading recent investigations..." />
          </div>
        ) : cases.length === 0 ? (
          <div className="p-6"><EmptyState message="No active cases" /></div>
        ) : (
          cases.map((c, i) => (
            <div key={c.caseId || c._id || i} className={`px-4 py-3 flex items-center justify-between hover:bg-gt-surface2 transition-colors cursor-pointer ${i !== cases.length - 1 ? 'border-b border-[rgba(255,255,255,0.04)]' : ''}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono font-bold text-gt-text">{c.caseId || c._id}</span>
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
                <span className="text-[10px] font-mono text-gt-dim">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
