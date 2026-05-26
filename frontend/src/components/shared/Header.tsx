'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useStore } from '@/lib/store';
import { PulseDot } from '@/components/shared/ui';
import SettingsModal from '@/components/shared/SettingsModal';
import { cn } from '@/lib/utils';
import { clearSession } from '@/lib/authSession';
import { getDashboardPath, resolveDashboardType } from '@/lib/authSession';
import {
  LayoutDashboard, ArrowLeftRight, ShieldAlert,
  Brain, BarChart3, Settings, Bell, Menu, Search, X, User, LogOut
} from 'lucide-react';

const NAV_TABS = [
  { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight,  badge: 'tx'    },
  { id: 'alerts',       label: 'Alerts',       icon: ShieldAlert,     badge: 'alert' },
  { id: 'agent',        label: 'Agent',        icon: Brain },
  { id: 'analytics',    label: 'Analytics',    icon: BarChart3 },
] as const;

const SEARCHABLE = [
  { label: 'Dashboard Overview', path: '/', tab: 'overview' },
  { label: 'Transactions', path: '/transactions', tab: 'transactions' },
  { label: 'Alerts', path: '/alerts', tab: 'alerts' },
  { label: 'AI Agent', path: '/agent', tab: 'agent' },
  { label: 'Analytics', path: '/analytics', tab: 'analytics' },
  { label: 'Cases', path: '/cases', tab: 'cases' },
  { label: 'Watchlist', path: '/watchlist', tab: 'watchlist' },
  { label: 'Models & Rules', path: '/models', tab: 'models' },
  { label: 'Reports', path: '/reports', tab: 'reports' },
  { label: 'Audit Logs', path: '/audit-logs', tab: 'audit-logs' },
  { label: 'Users', path: '/users', tab: 'users' },
  { label: 'Settings', path: '/settings', tab: 'settings' },
];

export default function Header() {
  const router = useRouter();
  const { wsConnected, activeTab, setActiveTab, activeAlerts, liveTransactions, sidebarOpen, setSidebarOpen, currentUser } = useStore();
  const [clock, setClock]             = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+K to open search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredSearch = searchQuery.trim()
    ? SEARCHABLE.filter((s) => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SEARCHABLE;

  const handleSearchSelect = (item: typeof SEARCHABLE[0]) => {
    setActiveTab(item.tab);
    router.push(item.path);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

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
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg p-2 text-gt-muted hover:bg-gt-surface2 transition-colors lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <Menu size={18} />
            </button>
            <div
              className="relative w-8 h-8 bg-gt-accent rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => {
                setActiveTab('overview');
                if (currentUser) {
                  router.push(getDashboardPath(resolveDashboardType(currentUser)));
                } else {
                  router.push('/');
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('overview')}
              aria-label="GhostTrace AI home"
            >
              <div
                className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,.15)_3px,rgba(0,0,0,.15)_6px)]"
              />
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="relative z-10">
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

          {/* ── Global Search ── */}
          <div className="hidden md:flex flex-1 max-w-xs mx-6">
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-gt-surface2 border border-[rgba(255,255,255,0.07)] rounded-lg text-[12px] font-mono text-gt-dim hover:border-gt-accent/30 transition-colors"
            >
              <Search size={13} />
              <span>Search pages…</span>
              <span className="ml-auto text-[10px] bg-gt-bg border border-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded">⌘K</span>
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Alert bell — visible only when open alerts exist */}
            {openAlertCount > 0 && (
              <button
                className="relative p-1.5 rounded-lg hover:bg-gt-surface2 transition-colors"
                onClick={() => {
                  setActiveTab('alerts');
                  router.push('/alerts');
                }}
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
                  ? 'border-gt-accent/25 text-gt-accent bg-[rgba(0,229,160,0.08)]'
                  : 'border-gt-danger/25 text-gt-danger bg-[rgba(255,59,92,0.08)]'
              )}
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

            {/* User avatar + logout */}
            <div className="flex items-center gap-1 pl-2 border-l border-[rgba(255,255,255,0.07)]">
              <div className="w-7 h-7 rounded-full bg-gt-accent/20 border border-gt-accent/30 flex items-center justify-center">
                <User size={13} className="text-gt-accent" />
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-gt-surface2 transition-colors"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={14} className="text-gt-muted" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Nav tabs ── */}
        <nav
          className="flex gap-0.5 px-6 bg-gt-surface border-b border-[rgba(255,255,255,0.07)] overflow-x-auto"
          role="tablist"
          aria-label="Dashboard navigation"
        >
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = getBadgeCount((tab as any).badge);
            const active = activeTab === tab.id;
            const ariaSelected = active ? 'true' : 'false';
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-current={active ? 'page' : undefined}
                aria-controls={`panel-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  router.push(tab.id === 'overview' ? '/' : `/${tab.id}`);
                }}
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

      {/* Settings modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-md bg-gt-surface border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
              <Search size={15} className="text-gt-muted flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pages and features…"
                className="flex-1 bg-transparent text-gt-text text-sm font-mono focus:outline-none placeholder:text-gt-dim"
                autoFocus
              />
              <button onClick={() => setSearchOpen(false)}><X size={14} className="text-gt-muted" /></button>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredSearch.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] font-mono text-gt-dim">No results found</div>
              ) : (
                filteredSearch.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleSearchSelect(item)}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-gt-text hover:bg-gt-surface2 transition-colors flex items-center gap-3"
                  >
                    <Search size={12} className="text-gt-muted" />
                    {item.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
