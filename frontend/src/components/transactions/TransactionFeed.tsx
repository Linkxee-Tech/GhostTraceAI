'use client';

import React from 'react';
import { Panel, PanelHeader, Badge, RiskBar, EmptyState } from '@/components/shared/ui';
import { useStore } from '@/lib/store';
import { STATUS_STYLES, formatAmount, maskAccountId } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { Zap, ShieldX, ShieldCheck, Flag, Eye, Lock, AlertTriangle } from 'lucide-react';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  cleared:      <ShieldCheck size={14} className="text-gt-accent" />,
  flagged:      <Flag        size={14} className="text-gt-warn"   />,
  blocked:      <ShieldX    size={14} className="text-gt-danger"  />,
  frozen:       <Lock       size={14} className="text-purple-400" />,
  under_review: <Eye        size={14} className="text-gt-blue"    />,
  pending:      <AlertTriangle size={14} className="text-gt-muted" />,
  approved:     <ShieldCheck size={14} className="text-gt-accent" />,
  rejected:     <ShieldX    size={14} className="text-gt-danger"  />,
};

interface TxRowProps { txn: Transaction; onClick?: () => void; }

function TxRow({ txn, onClick }: TxRowProps) {
  const hasScore = txn.fraudScore !== null;
  const amountColor =
    txn.fraudScore !== null && txn.fraudScore >= 80 ? 'text-gt-danger' :
    txn.fraudScore !== null && txn.fraudScore >= 50 ? 'text-gt-warn'   : 'text-gt-accent';

  return (
    <div
      onClick={onClick}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="grid items-center gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)] hover:bg-gt-surface2 transition-colors cursor-pointer animate-slide-in"
      style={{ gridTemplateColumns: '32px 1fr 90px 80px 80px 110px' }}
      aria-label={`Transaction ${txn.txnId}, ${formatAmount(txn.amount, txn.currency)}, ${txn.status}`}
    >
      {/* Status icon */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gt-surface2">
        {STATUS_ICONS[txn.status] ?? <AlertTriangle size={14} />}
      </div>

      {/* ID + meta */}
      <div className="min-w-0">
        <div className="text-[12px] font-mono font-bold text-gt-text truncate">{txn.txnId}</div>
        <div className="text-[11px] text-gt-muted truncate">
          {maskAccountId(txn.accountId)}
          {txn.merchant?.name  ? ` · ${txn.merchant.name}` : ''}
          {txn.geo?.country    ? ` · ${txn.geo.country}`   : ''}
        </div>
      </div>

      {/* Amount */}
      <div className={`text-[13px] font-mono font-bold text-right ${amountColor}`}>
        {formatAmount(txn.amount, txn.currency)}
      </div>

      {/* Risk bar */}
      <div className="flex justify-end">
        {hasScore
          ? <RiskBar score={txn.fraudScore!} />
          : <span className="text-[10px] font-mono text-gt-dim">Scoring…</span>}
      </div>

      {/* Status badge */}
      <div className="flex justify-end">
        <Badge className={STATUS_STYLES[txn.status] ?? ''}>
          {txn.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Time */}
      <div className="flex justify-end text-[11px] font-mono text-gt-muted">
        {new Date(txn.createdAt).toLocaleTimeString('en-GB', { hour12: false })}
      </div>
    </div>
  );
}

export function TransactionFeed() {
  const { liveTransactions, setSelectedTxnId, setActiveTab } = useStore();

  const handleClick = (txnId: string) => {
    setSelectedTxnId(txnId);
    setActiveTab('transactions');
  };

  return (
    <Panel>
      <PanelHeader
        title="Live Transaction Stream"
        icon={<Zap size={15} />}
        action={
          <span className="flex items-center gap-1.5 text-gt-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-gt-accent animate-pulse-slow" />
            STREAM ACTIVE
          </span>
        }
      />
      <div role="table" aria-label="Live transactions">
        {/* Column headers */}
        <div
          className="grid items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,0.05)] text-[10px] font-mono text-gt-dim uppercase tracking-wider"
          style={{ gridTemplateColumns: '32px 1fr 90px 80px 80px 110px' }}
          role="row"
        >
          <span />
          <span role="columnheader">Transaction</span>
          <span className="text-right" role="columnheader">Amount</span>
          <span className="text-right" role="columnheader">Risk</span>
          <span className="text-right" role="columnheader">Status</span>
          <span className="text-right" role="columnheader">Time</span>
        </div>

        <div role="rowgroup">
          {liveTransactions.length === 0
            ? <EmptyState message="Waiting for transactions…" />
            : liveTransactions.slice(0, 12).map((txn) => (
                <TxRow key={txn.txnId} txn={txn} onClick={() => handleClick(txn.txnId)} />
              ))
          }
        </div>
      </div>
    </Panel>
  );
}
