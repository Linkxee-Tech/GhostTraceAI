'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Panel, PanelHeader, Badge, Spinner } from '@/components/shared/ui';
import { Search, Plus, Filter, MoreHorizontal } from 'lucide-react';
import { fetchCases, createCase } from '@/lib/api';
import type { FraudCase } from '@/lib/types';
import toast from 'react-hot-toast';
import { CaseDetailsDrawer } from '@/components/cases/CaseDetailsDrawer';

const MOCK_CASES: FraudCase[] = [
  { _id: '1', caseId: 'CAS-001', title: 'High Velocity Transfers - Account #88392', status: 'Open', priority: 'High', assignedTo: 'Unassigned', relatedTxnIds: [], relatedAlertIds: [], notes: [], createdBy: 'System', createdAt: '2026-05-23T10:00:00Z', updatedAt: '2026-05-23T10:00:00Z' },
  { _id: '2', caseId: 'CAS-002', title: 'Impossible Travel - Login from RU', status: 'In Progress', priority: 'Critical', assignedTo: 'Alice S.', relatedTxnIds: [], relatedAlertIds: [], notes: [], createdBy: 'System', createdAt: '2026-05-23T08:00:00Z', updatedAt: '2026-05-23T08:00:00Z' },
  { _id: '3', caseId: 'CAS-003', title: 'Device Fingerprint Mismatch', status: 'Resolved', priority: 'Medium', assignedTo: 'Bob J.', relatedTxnIds: [], relatedAlertIds: [], notes: [], createdBy: 'System', createdAt: '2026-05-22T10:00:00Z', updatedAt: '2026-05-22T10:00:00Z' },
  { _id: '4', caseId: 'CAS-004', title: 'Repeated Pattern - Retail Fraud', status: 'Open', priority: 'Low', assignedTo: 'Unassigned', relatedTxnIds: [], relatedAlertIds: [], notes: [], createdBy: 'System', createdAt: '2026-05-21T10:00:00Z', updatedAt: '2026-05-21T10:00:00Z' },
];

export default function CasesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  
  const { data, isLoading, mutate } = useSWR('cases', () => fetchCases());
  const cases = data?.data || MOCK_CASES;

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.caseId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewCase = async () => {
    try {
      await createCase({ title: 'New Manual Case', priority: 'Medium' });
      toast.success('Case created successfully');
      mutate();
    } catch {
      toast.error('Failed to create case');
    }
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Case Management</h1>
          <p className="text-sm text-gt-muted">Manage fraud investigation cases and resolutions.</p>
        </div>
        <button 
          onClick={handleNewCase}
          className="flex items-center gap-2 bg-gt-accent text-black font-semibold px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          <span>New Case</span>
        </button>
      </div>

      <Panel>
        <PanelHeader 
          title="Active Cases" 
          action={
            <div className="flex items-center gap-3 text-gt-text text-sm">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gt-muted" />
                <input 
                  type="text" 
                  placeholder="Search cases..." 
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded pl-9 pr-3 py-1.5 focus:outline-none focus:border-gt-accent text-sm w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="flex items-center gap-1 hover:text-gt-accent transition-colors">
                <Filter size={14} /> Filter
              </button>
            </div>
          }
        />
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.05)] text-gt-muted">
                  <th className="px-4 py-3 font-medium">Case ID</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr 
                    key={c.caseId} 
                    onClick={() => setSelectedCaseId(c.caseId)}
                    className="border-b border-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{c.caseId}</td>
                    <td className="px-4 py-3 text-gt-text font-medium">{c.title}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        c.priority === 'Critical' ? 'bg-gt-danger/20 text-gt-danger' :
                        c.priority === 'High' ? 'bg-gt-warn/20 text-gt-warn' :
                        c.priority === 'Medium' ? 'bg-gt-blue/20 text-gt-blue' :
                        'bg-gt-dim text-gt-text'
                      }`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge size="sm" className={
                        c.status === 'Open' ? 'text-gt-warn border-gt-warn' :
                        c.status === 'In Progress' ? 'text-gt-blue border-gt-blue' :
                        'text-gt-accent border-gt-accent'
                      }>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gt-muted">{c.assignedTo}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-gt-muted hover:text-gt-text p-1">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      
      <CaseDetailsDrawer 
        caseId={selectedCaseId} 
        onClose={() => setSelectedCaseId(null)} 
      />
    </div>
  );
}
