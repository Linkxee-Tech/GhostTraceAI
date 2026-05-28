'use client';

import React, { useEffect, useState } from 'react';
import { Panel, PanelHeader, Badge, RiskBar, EmptyState, Spinner } from '@/components/shared/ui';
import { fetchTransactions } from '@/lib/api';
import { useStore } from '@/lib/store';
import { STATUS_STYLES, formatAmount, formatRelativeTime, maskAccountId, getRiskColor } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { ArrowLeftRight, Filter, Search, X } from 'lucide-react';
import useSWR from 'swr';

const STATUS_FILTERS = [
  { label: 'All',     value: ''             },
  { label: 'Blocked', value: 'blocked'      },
  { label: 'Flagged', value: 'flagged'      },
  { label: 'Review',  value: 'under_review' },
  { label: 'Cleared', value: 'cleared'      },
  { label: 'Frozen',  value: 'frozen'       },
];

// ── Detail Drawer ──────────────────────────────────────────────
function TransactionDetailDrawer({ txn, onClose }: { txn: Transaction; onClose: () => void }) {
  return (
    <div
      className="fixed inset-y-0 right-0 w-96 bg-gt-surface border-l border-[rgba(255,255,255,0.07)] z-50 overflow-y-auto shadow-2xl animate-slide-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Transaction details for ${txn.txnId}`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)] sticky top-0 bg-gt-surface z-10">
        <h2 className="text-sm font-bold font-mono text-gt-text">{txn.txnId}</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gt-surface2 transition-colors"
          aria-label="Close transaction details"
        >
          <X size={16} className="text-gt-muted" />
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* Amount + Status */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold font-display text-gt-text">
              {formatAmount(txn.amount, txn.currency)}
            </div>
            <div className="text-[11px] font-mono text-gt-muted mt-0.5">
              {txn.type} · {txn.channel}
            </div>
          </div>
          <Badge className={STATUS_STYLES[txn.status] ?? ''}>{txn.status.replace(/_/g, ' ')}</Badge>
        </div>

        {/* Fraud Score */}
        {txn.fraudScore !== null && (
          <div className="bg-gt-surface2 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-mono text-gt-muted">Fraud Score</span>
              <span className={`text-xl font-extrabold font-mono ${getRiskColor(txn.fraudScore)}`}>
                {txn.fraudScore}/100
              </span>
            </div>
            <RiskBar score={txn.fraudScore} width="100%" showLabel={false} />
            {txn.fraudConfidence !== null && txn.fraudConfidence !== undefined && (
              <div className="text-[10px] font-mono text-gt-dim mt-1.5">
                Confidence: {Math.round(txn.fraudConfidence * 100)}%
              </div>
            )}
          </div>
        )}

        {/* Fraud Reasons */}
        {txn.fraudReasons?.length > 0 && (
          <div>
            <p className="text-[11px] font-mono text-gt-muted mb-2 uppercase tracking-wider">
              Fraud Indicators
            </p>
            <div className="flex flex-wrap gap-1.5">
              {txn.fraudReasons.map((r) => (
                <span key={r} className="text-[10px] font-mono px-2 py-0.5 bg-gt-danger/10 text-gt-danger border border-gt-danger/20 rounded">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {([
            ['Account ID',       maskAccountId(txn.accountId)],
            ['Timestamp',        formatRelativeTime(txn.createdAt)],
            ['Merchant',         txn.merchant?.name    || '—'],
            ['Country',          txn.geo?.country      || '—'],
            ['Device',           txn.device?.isKnownDevice ? 'Known' : 'Unknown'],
            ['IP Country',       txn.device?.ipCountry || '—'],
            ['Velocity (1 min)', `${txn.velocityCount1min} txns`],
            ['Agent Action',     txn.agentAction       || 'pending'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="bg-gt-surface2 rounded-lg px-3 py-2">
              <div className="text-[10px] font-mono text-gt-dim mb-0.5 uppercase">{label}</div>
              <div className="text-[12px] font-mono text-gt-text truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Transaction Timeline */}
        <div>
          <p className="text-[11px] font-mono text-gt-muted mb-3 uppercase tracking-wider">
            Transaction Timeline
          </p>
          <div className="flex flex-col gap-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[rgba(255,255,255,0.05)]">
            <div className="flex gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full bg-gt-surface border-[3px] border-gt-blue mt-0.5 shadow-[0_0_0_4px_#0a0c0f]" />
              <div>
                <p className="text-[12px] font-bold text-gt-text">Initiated</p>
                <p className="text-[10px] font-mono text-gt-muted">API Gateway received payload</p>
              </div>
            </div>
            <div className="flex gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full bg-gt-surface border-[3px] border-gt-accent mt-0.5 shadow-[0_0_0_4px_#0a0c0f]" />
              <div>
                <p className="text-[12px] font-bold text-gt-text">Rule Engine</p>
                <p className="text-[10px] font-mono text-gt-muted">Passed basic velocity checks</p>
              </div>
            </div>
            {txn.fraudScore !== null && (
              <div className="flex gap-4 relative z-10">
                <div className="w-4 h-4 rounded-full bg-gt-surface border-[3px] border-gt-warn mt-0.5 shadow-[0_0_0_4px_#0a0c0f]" />
                <div>
                  <p className="text-[12px] font-bold text-gt-text">AI Agent Analysis</p>
                  <p className="text-[10px] font-mono text-gt-muted">Scored {txn.fraudScore}/100</p>
                </div>
              </div>
            )}
            <div className="flex gap-4 relative z-10">
              <div className={`w-4 h-4 rounded-full bg-gt-surface border-[3px] mt-0.5 shadow-[0_0_0_4px_#0a0c0f] ${txn.status === 'blocked' ? 'border-gt-danger' : 'border-gt-accent'}`} />
              <div>
                <p className={`text-[12px] font-bold ${txn.status === 'blocked' ? 'text-gt-danger' : 'text-gt-accent'}`}>{txn.status.toUpperCase()}</p>
                <p className="text-[10px] font-mono text-gt-muted">Final enforcement action</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Flags */}
        {(txn.device?.isTor || txn.device?.isVpn || txn.geo?.isAnomaly) && (
          <div className="flex flex-col gap-1.5">
            {txn.device?.isTor && (
              <div className="text-[11px] font-mono text-gt-danger bg-gt-danger/10 border border-gt-danger/20 rounded px-3 py-1.5">
                ⚠ TOR exit node detected
              </div>
            )}
            {txn.device?.isVpn && (
              <div className="text-[11px] font-mono text-gt-warn bg-gt-warn/10 border border-gt-warn/20 rounded px-3 py-1.5">
                ⚠ VPN usage detected
              </div>
            )}
            {txn.geo?.isAnomaly && (
              <div className="text-[11px] font-mono text-gt-danger bg-gt-danger/10 border border-gt-danger/20 rounded px-3 py-1.5">
                ⚠ Geo anomaly — {txn.geo.distanceFromLastKm.toLocaleString()} km jump
              </div>
            )}
          </div>
        )}

        {txn.reviewRequired && (
          <div className="text-[11px] font-mono text-gt-blue bg-gt-blue/10 border border-gt-blue/20 rounded px-3 py-1.5">
            ℹ Queued for analyst review
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transactions Page ──────────────────────────────────────────
export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [searchQuery, setSearchQuery]   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTxn, setSelectedTxn]   = useState<Transaction | null>(null);

  // Store access for offline fallback and selectedTxnId highlighting
  const { liveTransactions, selectedTxnId, currentUser } = useStore();
  const isDemoUser =
    currentUser?.accountType === 'demo' ||
    (currentUser?.email || '').toLowerCase().includes('demo');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const { data, isLoading } = useSWR(
    ['transactions', statusFilter, debouncedQuery, page],
    () => fetchTransactions({
      page,
      limit: 20,
      status: statusFilter || undefined,
      query: debouncedQuery || undefined,
    }),
    { refreshInterval: 5000, revalidateOnFocus: false }
  );

  // Use API data whenever a response exists (even empty); fall back only when API is unavailable.
  const hasApiResponse = Array.isArray(data?.data);
  const apiTransactions = data?.data ?? [];
  const total           = data?.pagination?.total ?? 0;
  const pages           = data?.pagination?.pages ?? 1;

  const storeTransactions = liveTransactions.filter((t) => {
    if (!statusFilter) return true;
    return t.status === statusFilter;
  });

  const transactions  = isDemoUser ? storeTransactions : (hasApiResponse ? apiTransactions : storeTransactions);
  const displayTotal  = isDemoUser ? storeTransactions.length : (hasApiResponse ? total : storeTransactions.length);
  const isOffline     = isDemoUser || (!isLoading && !hasApiResponse && storeTransactions.length > 0);

  // Open drawer for a txn that was navigated to from the feed
  React.useEffect(() => {
    if (selectedTxnId) {
      const match = transactions.find((t) => t.txnId === selectedTxnId);
      if (match) setSelectedTxn(match);
    }
  }, [selectedTxnId, transactions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader
          title={`Transactions (${displayTotal.toLocaleString()})`}
          icon={<ArrowLeftRight size={15} />}
          action={
            isOffline
              ? <span className="text-gt-warn">DEMO MODE</span>
              : <span className={isLoading ? 'text-gt-muted' : 'text-gt-accent'}>{isLoading ? 'LOADING…' : 'LIVE'}</span>
          }
        />

        {/* Filter bar */}
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gt-muted" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search transaction ID, account, merchant or source…"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.07)] bg-gt-surface2 px-10 py-2 text-[12px] font-mono text-gt-text placeholder:text-gt-dim focus:border-gt-accent/40 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gt-muted hover:text-gt-text"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-1 flex-wrap items-center" role="group" aria-label="Filter by status">
              <Filter size={13} className="text-gt-muted flex-shrink-0" aria-hidden="true" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  aria-pressed={statusFilter === f.value}
                  className={`px-3 py-1 text-[11px] font-mono rounded transition-colors border ${
                    statusFilter === f.value
                      ? 'bg-gt-accent/15 text-gt-accent border-gt-accent/30'
                      : 'text-gt-muted border-[rgba(255,255,255,0.06)] hover:text-gt-text hover:border-[rgba(255,255,255,0.12)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div
          className="grid items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,0.05)] text-[10px] font-mono text-gt-dim uppercase tracking-wider"
          style={{ gridTemplateColumns: '1fr 90px 80px 90px 90px 80px' }}
        >
          <span>Transaction</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Score</span>
          <span>Action</span>
          <span>Status</span>
          <span className="text-right">Time</span>
        </div>

        {/* Rows */}
        {isLoading && !transactions.length ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : transactions.length === 0 ? (
          <EmptyState message={statusFilter ? `No ${statusFilter} transactions` : 'No transactions yet'} />
        ) : (
          <div role="table" aria-label="Transactions">
            {transactions.map((txn) => {
              const isHighlighted = txn.txnId === selectedTxnId;
              return (
                <div
                  key={txn.txnId}
                  id={`txn-${txn.txnId}`}
                  onClick={() => setSelectedTxn(txn)}
                  role="row"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedTxn(txn)}
                  aria-label={`${txn.txnId} — ${formatAmount(txn.amount, txn.currency)} — ${txn.status}`}
                  className={`grid items-center gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)] hover:bg-gt-surface2 transition-colors cursor-pointer ${
                    isHighlighted ? 'bg-gt-accent/5 border-l-2 border-l-[#00e5a0]' : ''
                  }`}
                  style={{ gridTemplateColumns: '1fr 90px 80px 90px 90px 80px' }}
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-mono font-bold text-gt-text truncate">{txn.txnId}</div>
                    <div className="text-[10px] text-gt-muted truncate">
                      {maskAccountId(txn.accountId)}
                      {txn.merchant?.name ? ` · ${txn.merchant.name}` : ''}
                    </div>
                  </div>
                  <div className={`text-[12px] font-mono font-bold text-right ${getRiskColor(txn.fraudScore)}`}>
                    {formatAmount(txn.amount, txn.currency)}
                  </div>
                  <div className="flex justify-end">
                    {txn.fraudScore !== null
                      ? <RiskBar score={txn.fraudScore} showLabel={false} width="48px" />
                      : <span className="text-[10px] font-mono text-gt-dim">—</span>}
                  </div>
                  <div>
                    {txn.agentAction ? (
                      <Badge className={
                        txn.agentAction === 'block' || txn.agentAction === 'freeze'
                          ? 'bg-gt-danger/10 text-gt-danger border-gt-danger/20'
                          : txn.agentAction === 'flag' || txn.agentAction === 'request_review'
                          ? 'bg-gt-warn/10 text-gt-warn border-gt-warn/20'
                          : 'bg-gt-accent/10 text-gt-accent border-gt-accent/20'
                      }>
                        {txn.agentAction.replace('_', ' ')}
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-mono text-gt-dim">pending</span>
                    )}
                  </div>
                  <div>
                    <Badge className={STATUS_STYLES[txn.status] ?? ''}>{txn.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-[10px] font-mono text-gt-muted text-right">
                    {formatRelativeTime(txn.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination — only shown when using API data */}
        {pages > 1 && hasApiResponse && !isDemoUser && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(255,255,255,0.05)]">
            <span className="text-[11px] font-mono text-gt-muted">
              Page {page} of {pages} · {total.toLocaleString()} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-[11px] font-mono text-gt-muted border border-[rgba(255,255,255,0.08)] rounded hover:text-gt-text disabled:opacity-40 transition-colors"
              >← Prev</button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1 text-[11px] font-mono text-gt-muted border border-[rgba(255,255,255,0.08)] rounded hover:text-gt-text disabled:opacity-40 transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </Panel>

      {selectedTxn && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedTxn(null)} aria-hidden="true" />
          <TransactionDetailDrawer txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
        </>
      )}
    </div>
  );
}
