'use client';

import React from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Panel, Spinner } from '@/components/shared/ui';
import { fetchIngestionEvents, fetchIngestionSummary, fetchReplayJobs, queueReplayWindow, runReplayJob } from '@/lib/api';

export default function IngestionOpsPage() {
  const { data: summary, mutate: refreshSummary } = useSWR('ingestion-summary-page', () => fetchIngestionSummary(24));
  const { data: events, mutate: refreshEvents } = useSWR('ingestion-events-page', () => fetchIngestionEvents(100));
  const { data: jobs, mutate: refreshJobs } = useSWR('ingestion-replay-jobs-page', () => fetchReplayJobs(100));

  const refreshAll = async () => {
    await Promise.all([refreshSummary(), refreshEvents(), refreshJobs()]);
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Ingestion Monitoring</h1>
          <p className="text-sm text-gt-muted">Raw events, normalization failures, replay queue, and source stats.</p>
        </div>
        <button onClick={refreshAll} className="px-3 py-1.5 text-xs border border-[rgba(255,255,255,0.2)] rounded">
          Refresh
        </button>
      </div>

      <Panel className="p-4">
        {!summary ? <Spinner /> : (
          <div className="text-sm text-gt-muted space-y-2">
            <div>Status Stats: {summary.statusStats.map((s) => `${s._id}:${s.count}`).join(' | ') || 'none'}</div>
            <div>Source Stats: {summary.sourceStats.map((s) => `${s._id}:${s.count}`).join(' | ') || 'none'}</div>
            <div>Recent Failures: {summary.recentFailures.length}</div>
            <button
              className="px-3 py-1.5 text-xs border border-[rgba(255,255,255,0.2)] rounded"
              onClick={async () => {
                const now = new Date();
                const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);
                const result = await queueReplayWindow({ from: from.toISOString(), to: now.toISOString(), limit: 100 });
                toast.success(`Queued ${result.queuedJobs} jobs from ${result.candidateEvents} events`);
                await refreshJobs();
              }}
            >
              Queue Replay (Last 2 Hours)
            </button>
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <h2 className="text-lg font-bold text-gt-text mb-3">Replay Jobs</h2>
        {!jobs ? <Spinner /> : (
          <div className="space-y-2">
            {jobs.slice(0, 20).map((job) => (
              <div key={job.jobId} className="text-xs flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-1">
                <span>{job.jobId} • {job.status} • {job.sourceSystem || 'unknown'} • {job.attempts}/{job.maxAttempts}</span>
                {job.status !== 'completed' && (
                  <button
                    className="px-2 py-0.5 border border-[rgba(255,255,255,0.2)] rounded"
                    onClick={async () => {
                      await runReplayJob(job.jobId);
                      await refreshJobs();
                    }}
                  >
                    Run
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <h2 className="text-lg font-bold text-gt-text mb-3">Recent Ingestion Events</h2>
        {!events ? <Spinner /> : (
          <div className="space-y-2">
            {events.slice(0, 30).map((event) => (
              <div key={event.ingestId} className="text-xs border-b border-[rgba(255,255,255,0.06)] pb-1">
                <div>{event.ingestId} • {event.sourceSystem} • {event.processingStatus} • {new Date(event.receivedAt).toLocaleString()}</div>
                {event.rejectionReason ? <div className="text-gt-danger">Reason: {event.rejectionReason}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

