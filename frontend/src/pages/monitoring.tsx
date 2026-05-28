/* eslint-disable react/no-inline-styles */
'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Panel, PanelHeader, Badge, Spinner } from '@/components/shared/ui';
import { TrendingDown, AlertTriangle, Zap, Clock, Activity, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface SourceMetric {
  sourceSystem: string;
  totalEvents: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  acceptanceRate: number;
  errorRate: number;
  sourceTypes: { api: number; webhook: number };
  latestEventAt: string;
  oldestEventAt: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  throughputPerHour: number;
}

interface HealthData {
  windowHours: number;
  overallHealth: {
    totalEvents: number;
    acceptedCount: number;
    rejectedCount: number;
    acceptanceRate: number;
    healthStatus: string;
  };
  sourceMetrics: SourceMetric[];
}

interface BacklogData {
  queueStatus: {
    [key: string]: {
      count: number;
      avgAttempts: number;
      maxAttempts: number;
    };
  };
  pendingBySource: Array<{
    sourceSystem: string;
    pendingCount: number;
    oldestJobAt: string;
    backlogAgeMinutes: number;
  }>;
  deadLetterCount: number;
  failedCount: number;
  readyForRetryCount: number;
  futureRetryCount: number;
  totalBacklog: number;
}

interface Failure {
  ingestId: string;
  sourceSystem: string;
  sourceType: string;
  reason: string;
  receivedAt: string;
  externalEventId: string;
  requestorIp?: string;
}

interface QueueJobFailure {
  jobId: string;
  jobType: string;
  sourceSystem: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  createdAt: string;
  completedAt?: string;
}

interface FailureData {
  windowHours: number;
  ingestionFailures: Failure[];
  queueJobFailures: QueueJobFailure[];
  failureTimeline: Array<{ hour: string; failureCount: number }>;
  summary: {
    totalIngestFailures: number;
    totalQueueFailures: number;
  };
}

const fetchHealthData = async (hours: number): Promise<HealthData> => {
  const { data } = await apiClient.get<any>('/ingestion/monitor/health', {
    params: { hours },
  });
  return data.data;
};

const fetchBacklogData = async (): Promise<BacklogData> => {
  const { data } = await apiClient.get<any>('/ingestion/monitor/backlog');
  return data.data;
};

const fetchFailureData = async (hours: number): Promise<FailureData> => {
  const { data } = await apiClient.get<any>('/ingestion/monitor/failures', {
    params: { hours },
  });
  return data.data;
};

function HealthStatusBadge({ status }: { status: string }) {
  const variants: { [key: string]: { color: string; icon: string } } = {
    healthy: { color: 'bg-gt-accent text-black', icon: '✓' },
    degraded: { color: 'bg-gt-warn text-black', icon: '⚠' },
    unhealthy: { color: 'bg-gt-danger text-white', icon: '✕' },
  };
  const v = variants[status] || variants.unhealthy;
  return (
    <Badge className={`${v.color} font-mono text-xs`}>
      {v.icon} {status.toUpperCase()}
    </Badge>
  );
}

function FailureBar({ count, maxCount = 10 }: { count: number; maxCount?: number }) {
  const percentage = Math.min(100, (count / maxCount) * 100);
  // eslint-disable-next-line react/no-inline-styles
  return (
    <div className="flex-1 bg-gt-surface2 h-6 rounded flex items-center px-2 overflow-hidden">
      <div
        className="bg-gt-danger h-4 rounded transition-all"
        data-width={percentage}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit = '',
  accent = 'text-gt-blue',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  icon?: React.ComponentType<any>;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-[rgba(255,255,255,0.08)] rounded-lg bg-gt-surface2">
      {Icon && <Icon className={`${accent} flex-shrink-0`} size={16} />}
      <div>
        <p className="text-[10px] text-gt-muted uppercase tracking-wider font-mono">{label}</p>
        <p className="text-sm font-semibold text-gt-text font-mono">
          {value}
          {unit && <span className="text-xs text-gt-muted ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const [windowHours, setWindowHours] = useState(24);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: healthData, isLoading: healthLoading, error: healthError } = useSWR(
    [`ingestion-health-${windowHours}`, refreshKey],
    () => fetchHealthData(windowHours),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: backlogData, isLoading: backlogLoading, error: backlogError } = useSWR(
    [`ingestion-backlog`, refreshKey],
    () => fetchBacklogData(),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: failureData, isLoading: failureLoading, error: failureError } = useSWR(
    [`ingestion-failures-${windowHours}`, refreshKey],
    () => fetchFailureData(windowHours),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    toast.success('Refreshing monitoring data...');
  };

  const renderError = (error: any) => {
    if (!error) return null;
    return <div className="text-gt-danger text-sm">{error?.message || 'Failed to load data'}</div>;
  };

  return (
    <div className="max-w-7xl flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Ingestion Monitoring</h1>
          <p className="text-sm text-gt-muted">Real-time health, performance, and failure tracking.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
            aria-label="Time window for monitoring data"
            className="px-3 py-2 text-xs border border-[rgba(255,255,255,0.2)] rounded bg-gt-surface text-gt-text"
          >
            <option value={1}>Last 1 Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={72}>Last 3 Days</option>
            <option value={168}>Last 7 Days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={healthLoading || backlogLoading || failureLoading}
            className="px-3 py-2 text-xs border border-[rgba(255,255,255,0.2)] rounded bg-gt-surface hover:bg-gt-surface2 text-gt-text disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Health */}
      <Panel>
        <PanelHeader title="Overall Ingestion Health" subtitle={`Last ${windowHours} hours`} />
        {healthLoading ? (
          <div className="p-4"><Spinner /></div>
        ) : healthError ? (
          <div className="p-4">{renderError(healthError)}</div>
        ) : healthData ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
            <MetricCard
              label="Total Events"
              value={healthData.overallHealth.totalEvents.toLocaleString()}
              icon={Activity}
            />
            <MetricCard
              label="Acceptance Rate"
              value={`${healthData.overallHealth.acceptanceRate}%`}
              accent="text-gt-accent"
              icon={Zap}
            />
            <MetricCard
              label="Accepted"
              value={healthData.overallHealth.acceptedCount.toLocaleString()}
              accent="text-gt-accent"
            />
            <MetricCard
              label="Rejected"
              value={healthData.overallHealth.rejectedCount.toLocaleString()}
              accent="text-gt-danger"
            />
            <div className="flex items-center justify-center">
              <HealthStatusBadge status={healthData.overallHealth.healthStatus} />
            </div>
          </div>
        ) : null}
      </Panel>

      {/* Per-Source Metrics */}
      <Panel>
        <PanelHeader title="Per-Source Health Metrics" />
        {healthLoading ? (
          <div className="p-4"><Spinner /></div>
        ) : healthError ? (
          <div className="p-4">{renderError(healthError)}</div>
        ) : healthData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)]">
                  <th className="text-left px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Source</th>
                  <th className="text-right px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Total</th>
                  <th className="text-right px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Accepted</th>
                  <th className="text-right px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Rejected</th>
                  <th className="text-right px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Acc. Rate</th>
                  <th className="text-right px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Throughput/h</th>
                  <th className="text-center px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-2 text-gt-muted font-mono uppercase tracking-wider">Latest Event</th>
                </tr>
              </thead>
              <tbody>
                {healthData.sourceMetrics.map((source) => (
                  <tr key={source.sourceSystem} className="border-b border-[rgba(255,255,255,0.08)] hover:bg-gt-surface2/50">
                    <td className="px-4 py-2 text-gt-text font-mono">{source.sourceSystem}</td>
                    <td className="px-4 py-2 text-right text-gt-text">{source.totalEvents.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gt-accent">{source.acceptedCount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gt-danger">{source.rejectedCount.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${source.acceptanceRate >= 95 ? 'text-gt-accent' : source.acceptanceRate >= 80 ? 'text-gt-warn' : 'text-gt-danger'}`}>
                      {source.acceptanceRate}%
                    </td>
                    <td className="px-4 py-2 text-right text-gt-text">{source.throughputPerHour}</td>
                    <td className="px-4 py-2 text-center">
                      <HealthStatusBadge status={source.healthStatus} />
                    </td>
                    <td className="px-4 py-2 text-right text-gt-muted">
                      {new Date(source.latestEventAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {/* Processing Queue & Backlog */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel>
          <PanelHeader title="Queue Status" />
          {backlogLoading ? (
            <div className="p-4"><Spinner /></div>
          ) : backlogError ? (
            <div className="p-4">{renderError(backlogError)}</div>
          ) : backlogData ? (
            <div className="space-y-2 p-4">
              {Object.entries(backlogData.queueStatus || {}).map(([status, data]: any) => (
                <div key={status} className="flex items-center justify-between px-3 py-2 border border-[rgba(255,255,255,0.08)] rounded">
                  <div>
                    <p className="text-xs font-mono uppercase text-gt-muted">{status}</p>
                    <p className="text-sm font-semibold text-gt-text">{data.count} jobs</p>
                  </div>
                  <div className="text-right text-xs text-gt-muted">
                    <p>Avg {data.avgAttempts} attempts</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader title="Backlog Summary" />
          {backlogLoading ? (
            <div className="p-4"><Spinner /></div>
          ) : backlogError ? (
            <div className="p-4">{renderError(backlogError)}</div>
          ) : backlogData ? (
            <div className="grid grid-cols-2 gap-2 p-4">
              <MetricCard
                label="Total Backlog"
                value={backlogData.totalBacklog}
                accent="text-gt-warn"
                icon={Clock}
              />
              <MetricCard
                label="Ready to Retry"
                value={backlogData.readyForRetryCount}
                accent="text-gt-blue"
              />
              <MetricCard
                label="Future Retries"
                value={backlogData.futureRetryCount}
                accent="text-gt-muted"
              />
              <MetricCard
                label="Dead Letter"
                value={backlogData.deadLetterCount}
                accent="text-gt-danger"
                icon={AlertTriangle}
              />
            </div>
          ) : null}
        </Panel>
      </div>

      {/* Backlog by Source */}
      {(backlogData?.pendingBySource?.length ?? 0) > 0 && (
        <Panel>
          <PanelHeader title="Pending Backlog by Source" />
          <div className="space-y-2 p-4">
            {backlogData?.pendingBySource?.map((source) => (
              <div key={source.sourceSystem} className="flex items-center justify-between px-3 py-2 border border-[rgba(255,255,255,0.08)] rounded">
                <div>
                  <p className="text-xs font-mono uppercase text-gt-muted">{source.sourceSystem}</p>
                  <p className="text-sm font-semibold text-gt-text">{source.pendingCount} pending jobs</p>
                </div>
                <div className={`text-right text-xs font-mono ${source.backlogAgeMinutes > 60 ? 'text-gt-danger' : 'text-gt-warn'}`}>
                  {source.backlogAgeMinutes} min old
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Failure Timeline */}
      <Panel>
        <PanelHeader
          title="Failure Timeline"
          subtitle={failureData && `${failureData.summary.totalIngestFailures} ingestion failures, ${failureData.summary.totalQueueFailures} queue failures`}
        />
        {failureLoading ? (
          <div className="p-4"><Spinner /></div>
        ) : failureError ? (
          <div className="p-4">{renderError(failureError)}</div>
        ) : failureData ? (
          <div>
            {failureData.failureTimeline.length > 0 && (
              <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
                <p className="text-xs font-mono text-gt-muted uppercase tracking-wider mb-2">Failures by Hour</p>
                <div className="space-y-1">
                  {failureData.failureTimeline.slice(0, 12).map((t) => (
                    <div key={t.hour} className="flex items-center gap-2">
                      <span className="text-xs text-gt-muted min-w-[120px]">{new Date(t.hour).toLocaleString()}</span>
                      <FailureBar count={t.failureCount} />
                      <span className="text-xs font-semibold text-gt-danger min-w-[40px] text-right">{t.failureCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {failureData.ingestionFailures.length > 0 && (
              <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
                <p className="text-xs font-mono text-gt-muted uppercase tracking-wider mb-2">Recent Ingestion Failures ({failureData.ingestionFailures.length})</p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {failureData.ingestionFailures.slice(0, 20).map((f) => (
                    <div key={f.ingestId} className="text-xs border-l-2 border-gt-danger pl-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-gt-muted">{f.sourceSystem}</span>
                        <span className="text-gt-danger text-[10px]">{new Date(f.receivedAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-gt-danger mt-0.5">{f.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {failureData.queueJobFailures.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-mono text-gt-muted uppercase tracking-wider mb-2">Queue Job Failures ({failureData.queueJobFailures.length})</p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {failureData.queueJobFailures.slice(0, 20).map((j) => (
                    <div key={j.jobId} className="text-xs border-l-2 border-gt-danger pl-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-gt-text">{j.jobId}</span>
                        <span className="text-gt-danger text-[10px]">{j.attempts}/{j.maxAttempts} attempts</span>
                      </div>
                      <p className="text-gt-danger mt-0.5">{j.lastError}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
