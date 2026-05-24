'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Panel, Badge, Spinner } from '@/components/shared/ui';
import { FileText, Download, Calendar, Activity, ShieldAlert, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCases, fetchAlerts, fetchAuditLogs, fetchTransactions } from '@/lib/api';
import { exportToCSV } from '@/lib/export';

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  schedule: string;
  lastGenerated: string;
}

const REPORTS: ReportDef[] = [
  {
    id: 'fraud-summary',
    title: 'Executive Fraud Summary',
    description: 'High-level overview of fraud prevented, active threats, and financial impact.',
    icon: Activity,
    schedule: 'Weekly',
    lastGenerated: '2 days ago',
  },
  {
    id: 'analyst-productivity',
    title: 'Analyst Productivity Report',
    description: 'Metrics on case resolution times, false positive rates, and team performance.',
    icon: Calendar,
    schedule: 'Monthly',
    lastGenerated: '1 week ago',
  },
  {
    id: 'risk-compliance',
    title: 'Risk & Compliance Report',
    description: 'Detailed breakdown of system actions, flagged accounts, and regulatory compliance.',
    icon: ShieldAlert,
    schedule: 'Monthly',
    lastGenerated: '1 week ago',
  },
  {
    id: 'threat-intelligence',
    title: 'Threat Intelligence Export',
    description: 'Raw export of identified fraud patterns, malicious IPs, and associated metadata.',
    icon: FileText,
    schedule: 'On Demand',
    lastGenerated: 'Never',
  },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: casesData } = useSWR('cases-report', () => fetchCases({ limit: 500 }));
  const { data: alertsData } = useSWR('alerts-report', () => fetchAlerts({ limit: 500 }));
  const { data: auditData } = useSWR('audit-report', () => fetchAuditLogs({ limit: 500 }));
  const { data: txnData } = useSWR('txn-report', () => fetchTransactions({ limit: 500 }));

  const handleGenerate = async (report: ReportDef) => {
    setGenerating(report.id);
    const today = new Date().toISOString().split('T')[0];

    try {
      switch (report.id) {
        case 'fraud-summary': {
          const alerts = alertsData?.data || [];
          if (!alerts.length) throw new Error('No alert data available');
          const rows = alerts.map((a) => ({
            'Alert ID': a.alertId,
            'Account': a.accountId,
            'Severity': a.severity,
            'Fraud Score': a.fraudScore,
            'Confidence': `${a.fraudConfidence}%`,
            'Agent Action': a.agentAction,
            'Status': a.status,
            'Created': new Date(a.createdAt).toLocaleString(),
            'Trigger Reasons': a.triggerReasons.join('; '),
          }));
          exportToCSV(rows, `ghosttrace_fraud_summary_${today}`);
          break;
        }
        case 'analyst-productivity': {
          const cases = casesData?.data || [];
          if (!cases.length) throw new Error('No case data available');
          const rows = cases.map((c) => ({
            'Case ID': c.caseId,
            'Title': c.title,
            'Status': c.status,
            'Priority': c.priority,
            'Assigned To': c.assignedTo,
            'Created By': c.createdBy,
            'Note Count': c.notes?.length || 0,
            'Created': new Date(c.createdAt).toLocaleString(),
            'Updated': new Date(c.updatedAt).toLocaleString(),
          }));
          exportToCSV(rows, `ghosttrace_analyst_productivity_${today}`);
          break;
        }
        case 'risk-compliance': {
          const logs = auditData?.data || [];
          if (!logs.length) throw new Error('No audit log data available');
          const rows = logs.map((l) => ({
            'Log ID': l.logId,
            'Timestamp': new Date(l.timestamp).toLocaleString(),
            'User': l.user,
            'Action': l.action,
            'Resource': l.resource,
            'Status': l.status,
            'IP Address': l.ipAddress || '',
          }));
          exportToCSV(rows, `ghosttrace_risk_compliance_${today}`);
          break;
        }
        case 'threat-intelligence': {
          const txns = txnData?.data || [];
          if (!txns.length) throw new Error('No transaction data available');
          const rows = txns
            .filter((t) => t.isFraud || (t.fraudScore ?? 0) > 70)
            .map((t) => ({
              'Txn ID': t.txnId,
              'Account': t.accountId,
              'Amount': t.amount,
              'Currency': t.currency,
              'Fraud Score': t.fraudScore ?? 'N/A',
              'Status': t.status,
              'Agent Action': t.agentAction ?? 'none',
              'Is Fraud': t.isFraud ? 'Yes' : 'No',
              'Reasons': t.fraudReasons.join('; '),
              'Country': t.geo?.country || '',
              'Is Tor': t.device?.isTor ? 'Yes' : 'No',
              'Is VPN': t.device?.isVpn ? 'Yes' : 'No',
              'Timestamp': new Date(t.createdAt).toLocaleString(),
            }));
          if (!rows.length) throw new Error('No fraud transactions found to export');
          exportToCSV(rows, `ghosttrace_threat_intelligence_${today}`);
          break;
        }
      }
      toast.success(`${report.title} downloaded successfully`);
    } catch (err: any) {
      toast.error(err?.message || 'No data available yet — connect backend first');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Reports</h1>
          <p className="text-sm text-gt-muted">Generate and download analytical and compliance reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isGenerating = generating === report.id;
          return (
            <Panel key={report.id} className="flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-gt-surface2 rounded-lg text-gt-accent">
                    <Icon size={24} />
                  </div>
                  <Badge
                    size="sm"
                    className={
                      report.schedule === 'On Demand'
                        ? 'border-gt-blue text-gt-blue'
                        : 'border-gt-muted text-gt-muted'
                    }
                  >
                    {report.schedule}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-gt-text mb-2">{report.title}</h3>
                <p className="text-sm text-gt-muted">{report.description}</p>
                <div className="mt-4 text-xs text-gt-muted">
                  Last generated: {report.lastGenerated}
                </div>
              </div>
              <div className="border-t border-[rgba(255,255,255,0.05)] p-4 bg-[rgba(255,255,255,0.02)] flex justify-between items-center">
                <button
                  onClick={() => toast('Schedule configuration coming soon', { icon: '⚙️' })}
                  className="text-sm font-semibold text-gt-text hover:text-gt-accent transition-colors"
                >
                  Configure
                </button>
                <button
                  onClick={() => handleGenerate(report)}
                  disabled={isGenerating}
                  className="flex items-center gap-2 text-sm font-semibold text-black bg-gt-accent px-4 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {isGenerating ? (
                    <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                  ) : (
                    <><Download size={14} /> Generate</>
                  )}
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
