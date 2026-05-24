import React from 'react';
import { useRouter } from 'next/router';
import { useStore } from '@/lib/store';
import { LayoutDashboard, List, AlertCircle, FileText, Users, Database, Settings, FileSearch, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'alerts', label: 'Alerts', icon: AlertCircle },
  { id: 'cases', label: 'Cases', icon: FileText },
  { id: 'watchlist', label: 'Watchlist', icon: Users },
  { id: 'models', label: 'Models & Rules', icon: Database },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileSearch },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
];

export default function Sidebar() {
  const router = useRouter();
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen, currentUser } = useStore();

  const getPath = (id: string) => {
    if (id === 'overview') return '/';
    if (id === 'audit-logs') return '/audit-logs';
    return `/${id}`;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-50 w-64 bg-gt-surface border-r border-[rgba(255,255,255,0.04)] transition-transform',
        sidebarOpen ? 'translate-x-0' : '-translate-x-64'
      )}
      aria-hidden={!sidebarOpen}
    >
      <div className="px-4 py-5">
        <div className="flex items-center gap-3 mb-6">
           
           <div
              className="relative w-10 h-10 rounded-lg overflow-hidden cursor-pointer border border-[rgba(255,255,255,0.12)] bg-gt-surface2"
              onClick={() => {
                setActiveTab('overview');
                setSidebarOpen(false);
                router.push('/');
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('overview')}
              aria-label="GhostTrace AI home"
            >
              <img
                src="/ghosttrace_logo.png"
                alt="GhostTrace logo"
                className="w-full h-full object-cover"
              />
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

        <nav className="flex flex-col gap-1">
          {ITEMS.filter(it => {
            const adminOnly = ['users', 'models', 'settings', 'audit-logs'];
            if (adminOnly.includes(it.id)) {
              return currentUser?.role === 'admin';
            }
            return true;
          }).map((it) => {
            const Icon = it.icon;
            const active = activeTab === it.id;
            return (
              <button
                key={it.id}
                onClick={() => {
                  setActiveTab(it.id);
                  setSidebarOpen(false);
                  router.push(getPath(it.id));
                }}
                className={cn(
                  'flex items-center gap-3 w-full text-left px-3 py-2 rounded hover:bg-gt-surface2 transition-colors',
                  active ? 'bg-gt-surface2 text-gt-accent' : 'text-gt-text'
                )}
              >
                <Icon size={16} />
                <span className="text-sm font-semibold">{it.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6">
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-[11px] font-mono text-gt-muted hover:text-gt-text"
          >
            Close
          </button>
        </div>
      </div>
    </aside>
  );
}
