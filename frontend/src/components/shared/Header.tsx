'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { PulseDot } from '@/components/shared/ui';
import SettingsModal from '@/components/shared/SettingsModal';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ArrowLeftRight, ShieldAlert,
  Brain, BarChart3, Settings, Bell
} from 'lucide-react';

const NAV_TABS = [
  { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight,  badge: 'tx'    },
  { id: 'alerts',       label: 'Alerts',       icon: ShieldAlert,     badge: 'alert' },
  { id: 'agent',        label: 'Agent',        icon: Brain },
  { id: 'analytics',    label: 'Analytics',    icon: BarChart3 },
] as const;

export default function Header() {
  const { wsConnected, activeTab, setActiveTab, activeAlerts, liveTransactions } = useStore();
  const [clock, setClock]             = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const pendingTxCount  = liveTransactions.filter((t) => t.status === 'pending').length;
  const openAlertCount  = activeAlerts.filter((a) => a.status === 'open').length;

  const getBadgeCount = (badgeKey?: string) => {
    if (badgeKey === 'tx')    return pendingTxCount;
    if (badgeKey === 'alert') return openAlertCount;
    return 0;
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-gt-bg/95 backdrop-blur-sm">
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[rgba(255,255,255,0.07)]">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="relative w-8 h-8 bg-gt-accent rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => setActiveTab('overview')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('overview')}
              aria-label="GhostTrace AI home"
            >
              <div
                className="absolute inset-0"
                style={{ background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,.15) 3px,rgba(0,0,0,.15) 6px)' }}
              />
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                <path d="M9 1L2 5v8l7 4 7-4V5L9 1z" stroke="#0a0c0f" strokeWidth="1.5" fill="none" />
                <circle cx="9" cy="9" r="2.5" fill="#0a0c0f" />
                <path d="M9 4v2M9 12v2M4 9h2M12 9h2" stroke="#0a0c0f" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <div className="text-base font-extrabold font-display tracking-tight text-gt-text leading-none">
                GhostTrace AI
              </div>
              <div className="text-[10px] font-mono text-gt-accent tracking-widest uppercase mt-0.5">
                Fraud Intelligence
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Alert bell — visible only when open alerts exist */}
            {openAlertCount > 0 && (
              <button
                className="relative p-1.5 rounded-lg hover:bg-gt-surface2 transition-colors"
                onClick={() => setActiveTab('alerts')}
                aria-label={`${openAlertCount} open alerts`}
              >
                <Bell size={16} className="text-gt-warn" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gt-danger text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  {openAlertCount > 9 ? '9+' : openAlertCount}
                </span>
              </button>
            )}

            {/* WS status pill — uses inline style to avoid non-standard /8 Tailwind fraction */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono',
                wsConnected
                  ? 'border-gt-accent/25 text-gt-accent'
                  : 'border-gt-danger/25 text-gt-danger'
              )}
              style={{ background: wsConnected ? 'rgba(0,229,160,0.08)' : 'rgba(255,59,92,0.08)' }}
            >
              <PulseDot color={wsConnected ? '#00e5a0' : '#ff3b5c'} />
              {wsConnected ? 'LIVE' : 'DEMO'}
            </div>

            {/* Clock */}
            <div className="text-[12px] font-mono text-gt-muted tabular-nums hidden sm:block">
              {clock}
            </div>

            {/* Settings — opens modal */}
            <button
              className="p-1.5 rounded-lg hover:bg-gt-surface2 transition-colors"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
            >
              <Settings size={16} className="text-gt-muted" />
            </button>
          </div>
        </header>

        {/* ── Nav tabs ── */}
        <nav
          className="flex gap-0.5 px-6 bg-gt-surface border-b border-[rgba(255,255,255,0.07)] overflow-x-auto"
          role="tablist"
          aria-label="Dashboard navigation"
        >
          {NAV_TABS.map((tab) => {
            const Icon  = tab.icon;
            const count = getBadgeCount((tab as any).badge);
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex-shrink-0',
                  active
                    ? 'text-gt-accent border-gt-accent'
                    : 'text-gt-muted border-transparent hover:text-gt-text'
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {tab.label}
                {count > 0 && (
                  <span className="bg-gt-danger text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings modal — rendered outside sticky container */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
