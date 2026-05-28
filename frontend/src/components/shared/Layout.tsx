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
import { clearSession, getDashboardPath, getToken, resolveDashboardType } from '@/lib/authSession';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    wsConnected, setWsConnected, setStats, setActiveAlerts,
    setActiveTab, currentUser, setCurrentUser,
    setSidebarOpen,
  } = useStore();

  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();

    if (!token) {
      setAuthError('No active session found.');
      router.replace('/login');
      return;
    }

    const authTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setAuthError('Session verification timed out. Check API connectivity.');
        clearSession();
        router.replace('/login');
      }
    }, 10000);

    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) {
          window.clearTimeout(authTimeout);
          setCurrentUser(user);
          setAuthChecked(true);
          setAuthError(null);
          if (router.pathname === '/') {
            router.replace(getDashboardPath(resolveDashboardType(user)));
          }
        }
      })
      .catch(() => {
        window.clearTimeout(authTimeout);
        clearSession();
        setAuthError('Session verification failed. Please sign in again.');
        if (!cancelled) router.replace('/login');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(authTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSidebarOpen(window.innerWidth >= 1024);
    const handleResize = () => setSidebarOpen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  useWebSocket(
    {
      onConnected: () => setWsConnected(true),
      onDisconnected: () => setWsConnected(false),
      onTransactionUpdate: () => {},
      onAgentReasoning: () => {},
      onAgentError: () => {},
    },
    authChecked
  );

  const isDemoUser =
    currentUser?.accountType === 'demo' ||
    (currentUser?.email || '').toLowerCase().includes('demo');
  useDemoData(authChecked && (isDemoUser || !wsConnected));

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

  useEffect(() => {
    const path = router.pathname;
    if (path === '/' || path === '/dashboard' || path === '/admin' || path === '/demo') setActiveTab('overview');
    else setActiveTab(path.replace('/', ''));
  }, [router.pathname, setActiveTab]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gt-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={28} />
          <span className="text-[11px] font-mono text-gt-muted">
            {authError || 'Verifying session...'}
          </span>
          {authError && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.replace('/login')}
                className="px-3 py-1.5 bg-gt-surface2 border border-[rgba(255,255,255,0.1)] text-gt-text rounded text-[11px] font-mono"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const adminOnlyRoutes = ['/admin', '/users', '/models', '/settings', '/audit-logs', '/ingestion'];
  const isAdminOnly = adminOnlyRoutes.includes(router.pathname);

  if (isAdminOnly && currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gt-bg flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-display font-bold text-gt-danger mb-2">Access Denied</h1>
        <p className="text-sm text-gt-muted mb-6">You do not have permission to view this page.</p>
        <button
          onClick={() => {
            if (currentUser) {
              router.replace(getDashboardPath(resolveDashboardType(currentUser)));
            } else {
              router.replace('/');
            }
          }}
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
        <title>GhostTrace AI - Fraud Intelligence Platform</title>
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
          GhostTrace AI v1.0.0 - {currentUser ? `Signed in as ${currentUser.email} (${currentUser.role})` : 'Google Cloud Rapid Agent 2026'}
        </span>
        <span className="text-[10px] font-mono text-gt-dim">Gemini 3 - MongoDB Atlas - MCP - Cloud Run</span>
      </footer>
    </div>
  );
}
