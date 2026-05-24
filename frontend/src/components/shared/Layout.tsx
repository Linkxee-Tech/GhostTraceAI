import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from './Header';
import Sidebar from './Sidebar';
import { useStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useDemoData } from '@/hooks/useDemoData';
import { fetchStats, fetchAlerts, fetchCurrentUser } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    wsConnected, setWsConnected, setStats, setActiveAlerts,
    setActiveTab, currentUser, setCurrentUser,
  } = useStore();

  const [authChecked, setAuthChecked] = useState(false);

  // ── Auth guard: verify token on every mount ───────────────
  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('gt_token') : null;

    if (!token) {
      router.replace('/login');
      return;
    }

    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        // Token invalid / expired — clear and redirect
        localStorage.removeItem('gt_token');
        localStorage.removeItem('gt_role');
        if (!cancelled) router.replace('/login');
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWebSocket({
    onConnected: () => setWsConnected(true),
    onDisconnected: () => setWsConnected(false),
    onTransactionUpdate: () => {},
    onAgentReasoning: () => {},
    onAgentError: () => {},
  });

  useDemoData(!wsConnected);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [statsRes, alertsRes] = await Promise.allSettled([
          fetchStats(),
          fetchAlerts({ status: 'open', limit: 50 }),
        ]);
        if (cancelled) return;
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (alertsRes.status === 'fulfilled') setActiveAlerts(alertsRes.value.data);
      } catch (e) { /* ignore */ }
    };
    load();
    return () => { cancelled = true; };
  }, [setStats, setActiveAlerts]);

  // Sync activeTab with route
  useEffect(() => {
    const path = router.pathname;
    if (path === '/') setActiveTab('overview');
    else setActiveTab(path.replace('/', ''));
  }, [router.pathname, setActiveTab]);

  // Show minimal loader while auth check is in-flight
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gt-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={28} />
          <span className="text-[11px] font-mono text-gt-muted">Verifying session…</span>
        </div>
      </div>
    );
  }

  const adminOnlyRoutes = ['/users', '/models', '/settings', '/audit-logs'];
  const isAdminOnly = adminOnlyRoutes.includes(router.pathname);

  if (isAdminOnly && currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gt-bg flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-display font-bold text-gt-danger mb-2">Access Denied</h1>
        <p className="text-sm text-gt-muted mb-6">You do not have permission to view this page.</p>
        <button 
          onClick={() => router.replace('/')}
          className="px-4 py-2 bg-gt-surface2 border border-[rgba(255,255,255,0.1)] text-gt-text rounded text-sm hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gt-bg flex flex-col">
      <Head>
        <title>GhostTrace AI — Fraud Intelligence Platform</title>
        <meta name="description" content="Autonomous real-time fraud detection and response agent powered by Gemini AI and MongoDB" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Sidebar />
      <Header />

      <main className="flex-1 relative z-0">
        <div className="px-6 py-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-[rgba(255,255,255,0.05)] px-6 py-2 flex items-center justify-between flex-wrap gap-2 z-10 relative">
        <span className="text-[10px] font-mono text-gt-dim">
          GhostTrace AI v1.0.0 · {currentUser ? `Signed in as ${currentUser.email} (${currentUser.role})` : 'Google Cloud Rapid Agent 2026'}
        </span>
        <span className="text-[10px] font-mono text-gt-dim">Gemini 3 · MongoDB Atlas · MCP · Cloud Run</span>
      </footer>
    </div>
  );
}


