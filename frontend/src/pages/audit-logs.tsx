'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Panel, PanelHeader, Badge, Spinner } from '@/components/shared/ui';
import { Search, Filter, Download } from 'lucide-react';
import { fetchAuditLogs } from '@/lib/api';
import { exportToCSV } from '@/lib/export';
import type { AuditLog } from '@/lib/types';

const MOCK_LOGS: AuditLog[] = [
  { _id: '1', logId: 'LOG-1092', timestamp: '2026-05-23T14:32:11Z', user: 'system_agent', action: 'BLOCK_TRANSACTION', resource: 'TXN-88291', status: 'Success', ipAddress: '127.0.0.1' },
  { _id: '2', logId: 'LOG-1091', timestamp: '2026-05-23T14:30:05Z', user: 'alice.smith@ghosttrace.ai', action: 'UPDATE_CASE', resource: 'CAS-002', status: 'Success', ipAddress: '127.0.0.1' },
  { _id: '3', logId: 'LOG-1090', timestamp: '2026-05-23T14:15:22Z', user: 'system_agent', action: 'FLAG_ACCOUNT', resource: 'ACC-5512', status: 'Success', ipAddress: '127.0.0.1' },
  { _id: '4', logId: 'LOG-1089', timestamp: '2026-05-23T13:45:00Z', user: 'bob.jones@ghosttrace.ai', action: 'LOGIN', resource: 'Session', status: 'Success', ipAddress: '127.0.0.1' },
  { _id: '5', logId: 'LOG-1088', timestamp: '2026-05-23T13:42:10Z', user: 'unknown', action: 'LOGIN_FAILED', resource: 'Session', status: 'Failed', ipAddress: '127.0.0.1' },
];

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useSWR('audit-logs', () => fetchAuditLogs({ limit: 100 }));
  const logs = data?.data || MOCK_LOGS;

  const filteredLogs = logs.filter(log => 
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.logId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const exportData = filteredLogs.map(({ logId, timestamp, user, action, resource, status, ipAddress }) => ({
      'Log ID': logId,
      'Timestamp': timestamp,
      'User': user,
      'Action': action,
      'Resource': resource,
      'Status': status,
      'IP Address': ipAddress || ''
    }));
    exportToCSV(exportData, `ghosttrace_audit_logs_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Audit & Compliance Logs</h1>
          <p className="text-sm text-gt-muted">Immutable tracking of all system and user actions.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-gt-surface2 border border-[rgba(255,255,255,0.1)] text-gt-text font-semibold px-4 py-2 rounded hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          <Download size={16} />
          <span>Export CSV</span>
        </button>
      </div>

      <Panel>
        <PanelHeader 
          title="System Audit Trail" 
          action={
            <div className="flex items-center gap-3 text-gt-text text-sm">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gt-muted" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
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
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Log ID</th>
                  <th className="px-4 py-3 font-medium">User / Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.logId} className="border-b border-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-3 text-gt-muted font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.logId}</td>
                    <td className="px-4 py-3 text-gt-text">{log.user}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gt-blue">{log.action}</td>
                    <td className="px-4 py-3 text-gt-muted font-mono text-xs">{log.resource}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.status === 'Success' ? 'bg-gt-accent/20 text-gt-accent' : 'bg-gt-danger/20 text-gt-danger'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
